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
            raise ConflictError("Un étudiant possède déjà ce matricule.")
        
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
    
    # On enregistre l'email pour pouvoir lui envoyer le code
    user.email = payload.email
    
    db.commit()

    # Envoi de l'email
    from app.services import resend_email_service
    background_tasks.add_task(
        resend_email_service.send_activation_code_email,
        to_email=payload.email,
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


def _create_reset_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "aud": RESET_TOKEN_AUDIENCE,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode_reset_token(token: str) -> UUID:
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
        return UUID(sub)
    except JWTError as exc:
        raise ValidationError("Token de réinitialisation invalide ou expiré") from exc


def request_password_reset(db: Session, email: str) -> str | None:
    user = db.query(Student).filter(Student.email == email).first()
    if not user or not user.is_active or not user.is_activated:
        return None

    token = _create_reset_token(user.id)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    try:
        import asyncio
        from app.services import email_service

        asyncio.create_task(
            email_service.send_password_reset_email(
                to_email=user.email,
                voter_name=f"{user.first_name} {user.last_name}",
                reset_url=reset_url,
            )
        )
    except RuntimeError:
        logger.info("password reset token for %s : %s", email, reset_url)
    except Exception as exc:
        logger.warning("password reset email failed: %s", exc)
        logger.info("fallback link for %s : %s", email, reset_url)

    return token


def confirm_password_reset(db: Session, *, token: str, new_password: str) -> Student:
    from app.services import refresh_token_service

    user_id = _decode_reset_token(token)
    user = db.query(Student).filter(Student.id == user_id).first()
    if not user or not user.is_active:
        raise ValidationError("Token invalide ou compte introuvable")

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
