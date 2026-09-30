"""Enregistrement et changement d'adresse e-mail par l'étudiant.

L'adresse d'un compte n'est pas un simple champ de contact : elle ouvre le
compte par « Continuer avec Google » et reçoit les liens de réinitialisation.
Une adresse saisie par l'étudiant (à l'activation ou depuis son profil) reste
donc EN ATTENTE (`pending_email`) jusqu'à ce qu'il clique sur le lien envoyé à
cette adresse. Sans cette confirmation :
- une faute de frappe donnerait le compte au propriétaire de l'adresse saisie ;
- quelqu'un qui trouve une session restée ouverte en salle informatique y
  mettrait son propre Gmail, et reviendrait ensuite quand il veut par Google,
  même après un changement de mot de passe.

Le lien est un jeton signé qui porte l'adresse à confirmer. Il n'est valable
que si cette adresse est toujours celle en attente : demander une autre
adresse invalide les liens précédents.
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import BackgroundTasks
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.models import Student


logger = logging.getLogger(__name__)

TOKEN_AUDIENCE = "email-confirm"
TOKEN_TTL = timedelta(hours=48)


def normalize(email: str) -> str:
    return email.strip().lower()


def ensure_available(db: Session, email: str, *, user_id: UUID | None) -> None:
    """Refuse une adresse déjà utilisée par un autre compte."""
    q = db.query(Student).filter(func.lower(Student.email) == normalize(email))
    if user_id is not None:
        q = q.filter(Student.id != user_id)
    if q.first() is not None:
        raise ConflictError("Cette adresse e-mail est déjà utilisée par un autre compte.")


def _token(user: Student, email: str) -> str:
    return jwt.encode(
        {
            "sub": str(user.id),
            "email": email,
            "aud": TOKEN_AUDIENCE,
            "exp": datetime.now(timezone.utc) + TOKEN_TTL,
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def request_change(
    db: Session, *, user: Student, new_email: str, background_tasks: BackgroundTasks | None
) -> bool:
    """Met `new_email` en attente et envoie le lien. Retourne False si inutile.

    Le compte garde son adresse actuelle tant que la nouvelle n'est pas
    confirmée.
    """
    email = normalize(new_email)
    if user.email and normalize(user.email) == email:
        if user.pending_email:
            user.pending_email = None
            db.commit()
        return False

    ensure_available(db, email, user_id=user.id)
    user.pending_email = email
    db.commit()

    url = f"{settings.FRONTEND_URL.rstrip('/')}/confirmer-email#token={_token(user, email)}"
    from app.services import email_service

    if background_tasks is not None:
        background_tasks.add_task(
            email_service.send_email_confirmation_email,
            to_email=email,
            student_name=f"{user.first_name} {user.last_name}",
            confirm_url=url,
        )
    else:
        logger.info("confirmation d'adresse (aucun canal d'envoi) : %s", url)
    return True


def confirm(db: Session, *, token: str) -> tuple[Student, str | None]:
    """Applique l'adresse confirmée. Retourne (étudiant, ancienne adresse)."""
    invalid = ValidationError(
        "Ce lien de confirmation n'est plus valable. Demandez-en un nouveau depuis votre profil."
    )
    try:
        data = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience=TOKEN_AUDIENCE
        )
        user_id = UUID(str(data["sub"]))
        email = normalize(str(data["email"]))
    except (JWTError, KeyError, ValueError) as exc:
        raise invalid from exc

    user = db.query(Student).filter(Student.id == user_id).first()
    if user is None or not user.pending_email or normalize(user.pending_email) != email:
        raise invalid

    ensure_available(db, email, user_id=user.id)
    previous = user.email
    user.email = email
    user.pending_email = None
    db.commit()
    db.refresh(user)
    return user, previous
