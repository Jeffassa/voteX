"""Refresh tokens — émission, rotation, révocation, détection de reuse.

Pattern : refresh token rotation with reuse detection.
- À chaque /refresh, le token courant est révoqué et un nouveau est émis.
- Si un token déjà révoqué est présenté à nouveau → tentative de rejeu →
  on révoque TOUS les tokens de cet utilisateur (vol détecté).

Le token raw est sha256-hashé avant stockage. La DB ne contient JAMAIS
le token utilisable.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.models import RefreshToken, Student


logger = logging.getLogger(__name__)


def _hash_token(raw: str) -> str:
    """SHA-256 — assez rapide, on n'a pas besoin de bcrypt pour de
    l'entropie déjà 256 bits."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _new_jti() -> str:
    return secrets.token_urlsafe(16)


def _new_raw_token() -> str:
    """48 octets URL-safe = 384 bits d'entropie."""
    return secrets.token_urlsafe(48)



def _as_utc(value: datetime | None) -> datetime | None:
    """Ramène un datetime lu en base à un datetime aware UTC.

    Postgres (timestamptz) rend un datetime aware, SQLite rend un naïf. Sans
    normalisation, `record.expires_at < now` lève TypeError sur SQLite —
    c'est-à-dire en CI et sur tout déploiement mono-fichier.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def issue(
    db: Session,
    *,
    user: Student,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, RefreshToken]:
    """Crée un nouveau refresh token. Retourne (raw_token, db_record).
    Le raw_token doit être envoyé au client en cookie httpOnly et n'est plus
    accessible ensuite — la DB ne stocke que le hash."""
    raw = _new_raw_token()
    jti = _new_jti()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    record = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_hash=_hash_token(raw),
        user_agent=(user_agent or "")[:255] or None,
        ip_address=(ip_address or "")[:64] or None,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return raw, record


def rotate(
    db: Session,
    *,
    raw_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[Student, str, RefreshToken]:
    """Échange un refresh token valide contre un nouveau (rotation).

    Lève UnauthorizedError si :
    - le token n'existe pas en DB
    - le token est expiré
    - le token est déjà révoqué (→ révoque toute la chaîne, vol détecté)
    """
    token_hash = _hash_token(raw_token)
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if not record:
        # Token inconnu — peut être forgé ou ancien
        raise UnauthorizedError("Refresh token invalide")

    now = datetime.now(timezone.utc)

    # Détection de reuse : token déjà révoqué présenté à nouveau → vol
    if record.revoked_at is not None:
        logger.warning(
            "refresh: REUSE détecté pour user=%s jti=%s — révocation de toutes les sessions",
            record.user_id, record.jti,
        )
        revoke_all_for_user(db, user_id=record.user_id)
        raise UnauthorizedError(
            "Token déjà utilisé — toutes vos sessions ont été révoquées par sécurité"
        )

    if (_as_utc(record.expires_at) or now) < now:
        record.revoked_at = now
        db.commit()
        raise UnauthorizedError("Refresh token expiré")

    # Récupère l'utilisateur
    user = db.query(Student).filter(Student.id == record.user_id).first()
    if not user or not user.is_active:
        record.revoked_at = now
        db.commit()
        raise UnauthorizedError("Compte introuvable ou désactivé")

    # Émet le nouveau, marque l'ancien comme révoqué + tracé
    new_raw, new_record = issue(db, user=user, user_agent=user_agent, ip_address=ip_address)
    record.revoked_at = datetime.now(timezone.utc)
    record.replaced_by_jti = new_record.jti
    db.commit()

    return user, new_raw, new_record


def revoke(db: Session, *, raw_token: str) -> None:
    """Révoque un token spécifique (logout volontaire d'une session)."""
    token_hash = _hash_token(raw_token)
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )
    if record:
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()


def revoke_all_for_user(db: Session, *, user_id: UUID) -> int:
    """Révoque toutes les sessions d'un user (changement de mdp, vol détecté).
    Retourne le nombre de sessions révoquées."""
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.commit()
    return result.rowcount or 0


def list_active_for_user(db: Session, *, user_id: UUID) -> list[RefreshToken]:
    """Liste les sessions actives — utile pour une page 'mes appareils'."""
    now = datetime.now(timezone.utc)
    return (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.created_at.desc())
        .all()
    )
