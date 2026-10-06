"""Logique métier de l'authentification.

- register_student : revendication d'un compte pré-importé (matricule + nom matchent)
- authenticate : matricule + mdp, refuse les comptes non activés
- request_password_reset / confirm_password_reset : flow par email
- change_password : changement self-service
"""

import hmac
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from sqlalchemy.orm import Session

from fastapi import BackgroundTasks
from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    UnauthorizedError,
    ValidationError,
)
from app.core.matricule import names_match
from app.core.security import hash_password, verify_password
from app.models import Student
from app.services import email_change_service
from app.schemas.auth import ActivationCodeRequest, RegisterRequest


logger = logging.getLogger(__name__)

RESET_TOKEN_AUDIENCE = "password-reset"
RESET_TOKEN_EXPIRE_MINUTES = 30


def register_student(
    db: Session, payload: RegisterRequest, background_tasks: BackgroundTasks | None = None
) -> Student:
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
        
        # Le compte existe mais n'est pas activé : c'est un compte importé à revendiquer.
        #
        # Le code (6 caractères) se devinerait en quelques millions d'essais :
        # la limite par adresse IP ne l'empêche pas, un attaquant en change à
        # volonté. Les essais sont donc comptés sur le COMPTE, avec les paliers
        # de la connexion — le compte n'a pas encore de mot de passe, ces
        # compteurs sont libres. Quelques dizaines d'essais par jour au plus.
        _raise_if_locked(user, error=ValidationError)
        if user.activation_code:
            if not payload.activation_code:
                raise ValidationError("Le code d'activation est requis pour ce compte pré-importé.")
            if not hmac.compare_digest(
                user.activation_code.encode(), payload.activation_code.strip().upper().encode()
            ):
                _register_failure(db, user)
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
            
        # Adresse personnelle : vérifiée AVANT d'activer, pour ne pas activer
        # un compte puis répondre 409.
        if payload.email:
            email_change_service.ensure_available(db, payload.email, user_id=user.id)
        # Adresse choisie par le demandeur pour recevoir le code : le code
        # revenu prouve qu'il en a l'accès, elle deviendra celle du compte.
        claimed_email = user.pending_email if user.activation_code and not user.identity_verified else None
        if claimed_email:
            email_change_service.ensure_available(db, claimed_email, user_id=user.id)

        # Mise à jour du compte importé
        user.password_hash = hash_password(payload.password)
        user.activation_code = None
        user.failed_login_count = 0
        user.locked_until = None

        # Le compte ne devient utilisable QUE si l'identité a été confirmée par
        # un canal que l'école contrôle : adresse issue du fichier d'import, ou
        # code d'activation envoyé à une adresse déjà connue.
        #
        # Sinon, le seul « secret » présenté est le couple matricule + nom, qui
        # figure sur toute liste d'appel. La revendication part donc en salle
        # d'attente, où un administrateur tranche. C'est le compromis assumé :
        # une étape manuelle plutôt qu'un compte pris par le premier venu.
        if not user.identity_verified:
            user.is_active = False
            # Le compte reste en salle d'attente : l'adresse n'ouvre rien tant
            # qu'un administrateur n'a pas tranché, et un refus la retire.
            if claimed_email:
                user.email = claimed_email
                user.pending_email = None
            logger.info(
                "register: revendication non vérifiée pour matricule=%s — mise en attente",
                user.matricule,
            )
        
    else:
        # Auto-inscription d'un nouvel étudiant (salle d'attente)
        if payload.email:
            email_change_service.ensure_available(db, payload.email, user_id=None)

        user = Student(
            matricule=payload.matricule,
            first_name=payload.first_name,
            last_name=payload.last_name,
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

    if payload.email:
        email_change_service.request_change(
            db, user=user, new_email=payload.email, background_tasks=background_tasks
        )
    return user


async def send_activation_code(db: Session, payload: ActivationCodeRequest, background_tasks: BackgroundTasks) -> None:
    """Envoie un code d'activation si le matricule et le nom désignent un compte à activer.

    La réponse est la même dans tous les cas (« si les informations
    correspondent… ») : des erreurs distinctes disaient si un matricule
    existait, s'il était déjà activé et si le nom était juste, de quoi repérer
    les comptes encore à prendre. Seule la règle publique sur le domaine de
    l'adresse est signalée, avant toute recherche.
    """
    if not (payload.email.endswith("@esatic.edu.ci") or payload.email.endswith("@gmail.com")):
        raise ValidationError("Vous devez utiliser votre adresse email ESATIC (@esatic.edu.ci) ou Gmail (@gmail.com).")

    user = db.query(Student).filter(Student.matricule == payload.matricule).first()
    expected_full = f"{user.first_name} {user.last_name}" if user else ""
    submitted_full = f"{payload.first_name} {payload.last_name}"
    if (
        user is None
        or not user.is_active
        or user.is_activated
        or not names_match(expected_full, submitted_full)
    ):
        logger.info("activation: demande sans suite pour matricule=%s", payload.matricule)
        return

    # Un envoi par minute et cinq par heure pour un même compte : sans cela,
    # n'importe qui inondait la boîte d'un étudiant et changeait son code
    # avant qu'il ait pu le saisir.
    from app.core.rate_limit import allow

    if not allow("activation-code", str(user.id)):
        logger.info("activation: envoi limité pour matricule=%s", user.matricule)
        return

    # Génération du code
    import secrets
    activation_code = secrets.token_hex(3).upper() # 6 chars
    user.activation_code = activation_code

    # Le code part TOUJOURS vers l'adresse de l'école quand le compte en a une
    # (fichier d'import, ou saisie par un administrateur). Sinon, matricule +
    # nom (des informations qui circulent sur les listes de classe)
    # suffiraient à rediriger le code vers une boîte tierce, puis à revendiquer
    # le compte via /register : détournement complet.
    if user.email and user.identity_verified:
        destination = user.email
        if email_change_service.normalize(user.email) != email_change_service.normalize(payload.email):
            logger.warning(
                "activation: email divergent pour matricule=%s — envoi vers l'adresse en base",
                user.matricule,
            )
        # Recevoir le code prouve l'accès à la boîte que l'école détenait,
        # donc l'identité.
        user.pending_email = None
    else:
        # Aucune adresse connue de l'école : le demandeur choisit la boîte qui
        # recevra le code. Celui-ci ne prouve donc RIEN sur son identité — il
        # prouve seulement qu'il sait lire ses propres messages. La revendication
        # devra être validée par un administrateur.
        #
        # L'adresse n'est surtout PAS écrite dans `email` : à la demande
        # suivante, elle y aurait passé pour celle de l'école, et redemander un
        # code suffisait à obtenir une identité « vérifiée » — donc un compte
        # activé sans passer par la salle d'attente. Elle attend ici ; /register
        # la rattache au compte, toujours en attente, quand le code revient.
        destination = email_change_service.normalize(payload.email)
        user.pending_email = destination
        user.identity_verified = False

    db.commit()

    # Envoi par le chemin SMTP — le même que pour les codes distribués à
    # l'import, les reçus de vote et les réinitialisations. L'API Resend
    # attendait une clé `RESEND_API_KEY` qui n'est pas fournie au conteneur :
    # le code était composé puis abandonné, tandis que l'interface affichait
    # « Code envoyé ! Vérifie ta boîte mail. »
    from app.services import email_service
    background_tasks.add_task(
        email_service.send_activation_code_email,
        to_email=destination,
        voter_name=f"{user.first_name} {user.last_name}",
        activation_code=activation_code,
    )


# Verrouillage progressif : quelques essais malheureux sont normaux, une
# vingtaine ne l'est pas. Les paliers coûtent cher à un attaquant sans gêner un
# étudiant qui cherche son mot de passe.
LOCKOUT_STEPS = ((5, 1), (8, 5), (12, 30))  # (échecs cumulés, minutes de blocage)


def _lockout_minutes(failures: int) -> int | None:
    """Durée de blocage correspondant au nombre d'échecs, ou None."""
    palier = None
    for seuil, minutes in LOCKOUT_STEPS:
        if failures >= seuil:
            palier = minutes
    return palier


def _register_failure(db: Session, user: Student) -> None:
    """Compte un échec et verrouille le compte si le palier est atteint."""
    user.failed_login_count = (user.failed_login_count or 0) + 1
    minutes = _lockout_minutes(user.failed_login_count)
    if minutes:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        logger.warning(
            "auth: compte %s verrouillé %s min après %s échecs",
            user.matricule, minutes, user.failed_login_count,
        )
    db.commit()


def _raise_if_locked(user: Student, *, error: type[Exception] = UnauthorizedError) -> None:
    """Refuse toute tentative tant que le verrou du compte court."""
    locked_until = user.locked_until
    if locked_until is None:
        return
    if locked_until.tzinfo is None:  # SQLite rend un datetime naïf
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if locked_until > datetime.now(timezone.utc):
        reste = int((locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        hint = ", ou utilisez « mot de passe oublié »" if error is UnauthorizedError else ""
        raise error(f"Trop de tentatives. Réessayez dans {reste} minute(s){hint}.")


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

    # Le verrou porte sur le COMPTE visé, pas sur l'adresse IP : dans une salle
    # informatique, toute une promotion sort par la même IP publique. Une limite
    # par IP y punirait les voisins de l'attaquant plutôt que l'attaquant.
    _raise_if_locked(user)

    if not user.is_active:
        raise ForbiddenError("Compte désactivé. Contacte l'administration.")

    if not user.is_activated:
        raise UnauthorizedError(
            "Compte non activé. Va sur la page d'inscription pour définir ton mot de passe."
        )

    if not verify_password(password, user.password_hash):
        _register_failure(db, user)
        raise UnauthorizedError("Matricule ou mot de passe incorrect")

    # Connexion réussie : le compteur repart de zéro, sinon des échecs étalés
    # sur des semaines finiraient par verrouiller un utilisateur légitime.
    if user.failed_login_count or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        db.commit()

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
            options={"require": ["sub", "exp", "aud"]},
        )
        return UUID(payload["sub"]), payload.get("pwd_v")
    except (jwt.InvalidTokenError, ValueError) as exc:
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
    # Même limite par compte que le code d'activation : la réponse reste
    # neutre, mais la boîte n'est pas inondée.
    from app.core.rate_limit import allow

    if not allow("password-reset", str(user.id)):
        logger.info("password reset: envoi limité pour user=%s", user.id)
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
        logger.info(
            "password reset (aucun canal d'envoi) pour %s : %s", email, email_service.loggable(reset_url)
        )

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
    # Le message affiché à un compte verrouillé propose « mot de passe oublié »
    # comme issue : encore faut-il que cette porte s'ouvre. Qui a suivi le lien
    # reçu dans sa boîte a prouvé davantage qu'un mot de passe, et la série
    # d'essais que le verrou punissait est terminée.
    user.failed_login_count = 0
    user.locked_until = None
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
    # Même raison qu'au-dessus : l'ancien mot de passe a été fourni, il n'y a
    # plus de tâtonnement à sanctionner.
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)

    revoked = refresh_token_service.revoke_all_for_user(db, user_id=user.id)
    logger.info("password change: revoked %s sessions for user=%s", revoked, user.id)
    return user
