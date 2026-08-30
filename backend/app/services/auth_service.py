"""Logique métier de l'authentification.

- register_student : revendication d'un compte pré-importé (matricule + nom matchent)
- authenticate : matricule + mdp, refuse les comptes non activés
- request_password_reset / confirm_password_reset : flow par email
- change_password : changement self-service
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from fastapi import BackgroundTasks
from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.core.matricule import names_match
from app.core.security import hash_password, verify_password
from app.models import Student
from app.schemas.auth import ActivationCodeRequest, RegisterRequest


logger = logging.getLogger(__name__)

RESET_TOKEN_AUDIENCE = "password-reset"
RESET_TOKEN_EXPIRE_MINUTES = 30


def register_student(db: Session, payload: RegisterRequest) -> Student:
    """Revendique un compte pré-importé par l'admin.

    Le matricule doit déjà exister en base (importé via /api/students/import).
    Le nom complet saisi doit correspondre à celui en base (insensible à la
    casse + accents). Le compte ne doit pas déjà être activé.
    """
    user = db.query(Student).filter(Student.matricule == payload.matricule).first()
    
    # Si le matricule existe déjà
    if user:
        if user.is_activated:
            raise ConflictError(
                "Ce compte est déjà activé. Connectez-vous ou utilisez "
                "« mot de passe oublié »."
            )
        
        # Le compte existe mais n'est pas activé : c'est un compte importé à revendiquer
        if user.activation_code:
            if not payload.activation_code:
                raise ValidationError("Le code d'activation est requis pour ce compte pré-importé.")
            if user.activation_code != payload.activation_code.strip().upper():
                raise ValidationError("Code d'activation invalide.")
                
        # Vérification du nom
        expected_full = f"{user.first_name} {user.last_name}"
        submitted_full = f"{payload.first_name} {payload.last_name}"
        if not names_match(expected_full, submitted_full):
            logger.warning(
                "register: name mismatch for matricule=%s expected=%r got=%r",
                payload.matricule, expected_full, submitted_full,
            )
            raise ValidationError(
                "Le nom saisi ne correspond pas à celui enregistré pour ce matricule."
            )
            
        # Mise à jour du compte importé
        user.password_hash = hash_password(payload.password)
        if payload.email:
            existing_email = db.query(Student).filter(Student.email == payload.email, Student.id != user.id).first()
            if existing_email:
                raise ConflictError("Email déjà utilisé par un autre compte")
            user.email = payload.email
            
        # Si le compte importé était inactif (comportement par défaut des imports), il reste inactif (salle d'attente)
        
    else:
        # Auto-inscription d'un nouvel étudiant (salle d'attente)
        if payload.email:
            existing_email = db.query(Student).filter(Student.email == payload.email).first()
            if existing_email:
                raise ConflictError("Email déjà utilisé par un autre compte")
                
        user = Student(
            matricule=payload.matricule,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            is_active=False,  # En attente d'activation admin
        )
        if payload.class_id:
            from uuid import UUID
            try:
                user.class_id = UUID(payload.class_id)
            except ValueError:
                pass
                
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


async def send_activation_code(db: Session, payload: ActivationCodeRequest, background_tasks: BackgroundTasks) -> None:
    """Vérifie le matricule et le nom, valide l'email esatic.edu.ci, génère un code et l'envoie."""
    user = db.query(Student).filter(Student.matricule == payload.matricule).first()
    if not user:
        raise NotFoundError("Matricule inconnu.")

    if not user.is_active:
        raise ForbiddenError("Compte désactivé.")

    if user.is_activated:
        raise ConflictError("Ce compte est déjà activé. Connectez-vous.")

    # Vérification du nom
    expected_full = f"{user.first_name} {user.last_name}"
    submitted_full = f"{payload.first_name} {payload.last_name}"
    if not names_match(expected_full, submitted_full):
        raise ValidationError("Le nom saisi ne correspond pas à celui enregistré.")

    # Vérification du domaine de l'email
    if not (payload.email.endswith("@esatic.edu.ci") or payload.email.endswith("@gmail.com")):
        raise ValidationError("Vous devez utiliser votre adresse email ESATIC (@esatic.edu.ci) ou Gmail (@gmail.com).")

    # Génération du code
    import secrets
    activation_code = secrets.token_hex(3).upper() # 6 chars
    user.activation_code = activation_code

    # Le code part TOUJOURS vers l'adresse déjà rattachée au compte quand il y
    # en a une. Sinon, matricule + nom (des informations qui circulent sur les
    # listes de classe) suffiraient à rediriger le code vers une boîte tierce,
    # puis à revendiquer le compte via /register : détournement complet.
    # Un compte fraîchement importé n'a pas d'email : là, on enregistre celui
    # que l'étudiant fournit.
    destination = user.email or payload.email
    if not user.email:
        user.email = payload.email
    elif user.email.lower() != payload.email.lower():
        logger.warning(
            "activation: email divergent pour matricule=%s — envoi vers l'adresse en base",
            user.matricule,
        )

    db.commit()

    # Envoi de l'email
    from app.services import resend_email_service
    background_tasks.add_task(
        resend_email_service.send_activation_code_email,
        to_email=destination,
        student_name=f"{user.first_name} {user.last_name}",
        activation_code=activation_code,
    )


def authenticate(db: Session, matricule: str, password: str) -> Student:
    """Authentifie un utilisateur — messages d'erreur différenciés.

    Compromis fait : on accepte une légère fuite d'info (compte non activé) car
    pour un système scolaire interne, l'UX prime sur la résistance à l'énumération.
    Pour bloquer l'énumération en prod, fusionner les messages dans la branche 401.
    """
    if not matricule or not matricule.strip():
        raise UnauthorizedError("Matricule requis")
    if not password:
        raise UnauthorizedError("Mot de passe requis")

    user = db.query(Student).filter(Student.matricule == matricule.strip()).first()

    if not user:
        raise UnauthorizedError("Matricule ou mot de passe incorrect")

    if not user.is_active:
        raise ForbiddenError("Compte désactivé. Contacte l'administration.")

    if not user.is_activated:
        raise UnauthorizedError(
            "Compte non activé. Va sur la page d'inscription pour définir ton mot de passe."
        )

    if not verify_password(password, user.password_hash):
        raise UnauthorizedError("Matricule ou mot de passe incorrect")

    return user


# ───────────────────── password reset ─────────────────────


def _create_reset_token(user_id: UUID, password_version: int) -> str:
    """Le token porte la version du mot de passe au moment de l'émission.

    Conséquence : dès que le mot de passe change (reset abouti, changement
    self-service, révocation admin), password_version est incrémenté et TOUS
    les liens de reset émis avant deviennent inutilisables — au lieu de rester
    rejouables jusqu'à leur expiration.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "pwd_v": password_version,
        "aud": RESET_TOKEN_AUDIENCE,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode_reset_token(token: str) -> tuple[UUID, int | None]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=RESET_TOKEN_AUDIENCE,
        )
        sub = payload.get("sub")
        if not sub:
            raise ValidationError("Token invalide")
        return UUID(sub), payload.get("pwd_v")
    except JWTError as exc:
        raise ValidationError("Token de réinitialisation invalide ou expiré") from exc


def request_password_reset(
    db: Session, email: str, background_tasks: BackgroundTasks | None = None
) -> str | None:
    """Émet un lien de réinitialisation et programme son envoi.

    L'envoi passe par BackgroundTasks : la route est synchrone, donc elle
    s'exécute dans le threadpool où il n'existe aucune boucle asyncio — un
    `asyncio.create_task` y échoue silencieusement et le mail ne part jamais.
    """
    user = db.query(Student).filter(Student.email == email).first()
    if not user or not user.is_active or not user.is_activated:
        return None

    token = _create_reset_token(user.id, user.password_version)
    # Le jeton voyage dans le FRAGMENT (#), pas dans la query string : un
    # fragment n'est jamais transmis au serveur, n'apparaît donc ni dans les
    # journaux d'accès, ni dans ceux d'un reverse proxy, ni dans l'en-tête
    # Referer d'une ressource tierce chargée par la page.
    reset_url = f"{settings.FRONTEND_URL}/reset-password#token={token}"

    from app.services import email_service

    if background_tasks is not None:
        background_tasks.add_task(
            email_service.send_password_reset_email,
            to_email=user.email,
            voter_name=f"{user.first_name} {user.last_name}",
            reset_url=reset_url,
        )
    else:
        logger.info("password reset (aucun canal d'envoi) pour %s : %s", email, reset_url)

    return token


def confirm_password_reset(db: Session, *, token: str, new_password: str) -> Student:
    from app.services import refresh_token_service

    user_id, token_pwd_v = _decode_reset_token(token)
    user = db.query(Student).filter(Student.id == user_id).first()
    if not user or not user.is_active:
        raise ValidationError("Token invalide ou compte introuvable")
    # Un lien déjà consommé (ou émis avant un autre changement de mdp) est mort.
    if token_pwd_v is not None and token_pwd_v != user.password_version:
        raise ValidationError("Ce lien de réinitialisation n'est plus valide.")

    user.password_hash = hash_password(new_password)
    user.password_version += 1
    db.commit()
    db.refresh(user)

    revoked = refresh_token_service.revoke_all_for_user(db, user_id=user.id)
    logger.info("password reset: revoked %s sessions for user=%s", revoked, user.id)
    return user


def change_password(
    db: Session, *, user: Student, old_password: str, new_password: str
) -> Student:
    from app.services import refresh_token_service

    if not user.is_activated or not verify_password(old_password, user.password_hash):
        raise UnauthorizedError("Ancien mot de passe incorrect")
    if old_password == new_password:
        raise ValidationError("Le nouveau mot de passe doit être différent de l'ancien")

    user.password_hash = hash_password(new_password)
    user.password_version += 1
    db.commit()
    db.refresh(user)

    revoked = refresh_token_service.revoke_all_for_user(db, user_id=user.id)
    logger.info("password change: revoked %s sessions for user=%s", revoked, user.id)
    return user
