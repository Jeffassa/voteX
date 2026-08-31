"""Helpers pour les cookies d'authentification.

Stratégie de cookies :
- `sv_access`  : access token JWT, httpOnly, courte durée (15 min)
- `sv_refresh` : refresh token opaque, httpOnly, path scopé /api/auth, 7 jours

Il n'existe volontairement AUCUN cookie lisible par le JavaScript. Le jeton
CSRF est scellé dans l'access token et transmis au client par l'en-tête de
réponse `X-CSRF-Token` — voir app/core/csrf.py.

httpOnly : empêche un XSS de lire le cookie via document.cookie
Secure   : envoyé seulement sur HTTPS (true en prod, false en dev sur localhost)
SameSite=lax : envoyé sur navigation top-level GET (login, redirect) mais pas
   sur les POST cross-site (mitigation CSRF de base)
"""

from fastapi import Response

from app.core.config import settings


ACCESS_COOKIE = "sv_access"
REFRESH_COOKIE = "sv_refresh"
CSRF_HEADER = "X-CSRF-Token"

# Le refresh cookie n'est envoyé QUE sur les routes /api/auth/* — réduit
# la surface si jamais le cookie fuite via une vulnérabilité d'autre route.
REFRESH_COOKIE_PATH = "/api/auth"


def _common_kwargs(secure_override: bool | None = None) -> dict:
    return {
        "secure": secure_override if secure_override is not None else settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
        "domain": settings.COOKIE_DOMAIN or None,
    }


def set_access_cookie(response: Response, token: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        path="/",
        **_common_kwargs(),
    )


def set_refresh_cookie(response: Response, token: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        path=REFRESH_COOKIE_PATH,
        **_common_kwargs(),
    )


def clear_auth_cookies(response: Response) -> None:
    common = _common_kwargs()
    response.delete_cookie(ACCESS_COOKIE, path="/", **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, **common)
    # `sv_csrf` a existé jusqu'à l'abandon du double-submit : on continue de le
    # supprimer, sinon un navigateur qui le détient encore le garderait.
    response.delete_cookie("sv_csrf", path="/", **common)
