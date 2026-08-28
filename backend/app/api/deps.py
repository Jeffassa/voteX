"""Dépendances d'authentification.

L'access token peut venir de deux sources :
1. Cookie `sv_access` (httpOnly) — usage normal du SPA
2. Header `Authorization: Bearer <token>` — usage CLI / Swagger /docs / scripts

Le cookie est tenté en premier (priorité au flux navigateur sécurisé).

Validation en couches :
1. Décodage JWT (signature, exp, iss, aud) — voir security.decode_token
2. user actif en DB
3. pwd_v du token == password_version DB
4. role du token == role DB
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.cookies import ACCESS_COOKIE
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Student
from app.models.student import UserRole


logger = logging.getLogger(__name__)

# auto_error=False : on ne plante pas si pas de header — on tentera le cookie
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _extract_token(request: Request, header_token: str | None) -> str | None:
    """Cookie en priorité (flow SPA sécurisé), header Bearer en fallback."""
    cookie_token = request.cookies.get(ACCESS_COOKIE)
    return cookie_token or header_token


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    header_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> Student:
    token = _extract_token(request, header_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non authentifié",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_pwd_v = payload.get("pwd_v")
        token_role = payload.get("role")
        if not user_id or token_pwd_v is None or not token_role:
            raise ValueError("claims requis manquants")
        user_uuid = UUID(user_id)
    except (ValueError, TypeError) as exc:
        logger.info("auth: token invalide : %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = (
        db.query(Student)
        .filter(Student.id == user_uuid, Student.is_active.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_pwd_v != user.password_version:
        logger.warning(
            "auth: token stale pour user=%s (token_pwd_v=%s db=%s)",
            user.id, token_pwd_v, user.password_version,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée. Reconnectez-vous.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_role != user.role.value:
        logger.warning(
            "auth: rôle divergent pour user=%s (token=%s db=%s)",
            user.id, token_role, user.role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Rôle modifié. Reconnectez-vous.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(user: Annotated[Student, Depends(get_current_user)]) -> Student:
    if user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Privilèges admin requis")
    return user


def require_super_admin(user: Annotated[Student, Depends(get_current_user)]) -> Student:
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Privilèges super-admin requis")
    return user
