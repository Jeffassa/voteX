"""Protection CSRF — pattern double-submit cookie.

Pour les requêtes mutatives (POST/PUT/PATCH/DELETE), on exige que la valeur
du cookie `sv_csrf` (lisible par le JS) soit aussi présente dans le header
`X-CSRF-Token`. Un attaquant cross-origin :
- ne peut pas lire le cookie sv_csrf (Same-Origin Policy bloque l'accès cross-origin
  aux cookies, même non-httpOnly, sauf si CORS explicitement permis)
- ne peut pas définir le header X-CSRF-Token sur une requête cross-origin sans
  preflight CORS qu'on n'autorise pas pour des origines arbitraires

Combiné avec SameSite=lax sur les cookies d'auth, ça donne une défense en profondeur.
"""

import hmac
import secrets

from fastapi import Request

from app.core.cookies import CSRF_COOKIE, CSRF_HEADER


# Routes exemptées du check CSRF :
# - login/register : pas encore de session, le CSRF cookie n'existe pas encore
# - password-reset/* : flow public déclenché par l'utilisateur via email
# - refresh : protégé par la possession du refresh cookie (httpOnly), pas accessible via XHR cross-origin
CSRF_EXEMPT_PATHS = frozenset(
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/request-activation-code",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/confirm",
        "/api/auth/refresh",
    }
)

CSRF_PROTECTED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def generate_csrf_token() -> str:
    """32 octets URL-safe = 256 bits d'entropie."""
    return secrets.token_urlsafe(32)


def verify_csrf(request: Request) -> bool:
    """Compare cookie et header en temps constant."""
    cookie_value = request.cookies.get(CSRF_COOKIE)
    header_value = request.headers.get(CSRF_HEADER)
    if not cookie_value or not header_value:
        return False
    return hmac.compare_digest(cookie_value, header_value)


def needs_csrf_check(request: Request) -> bool:
    if request.method not in CSRF_PROTECTED_METHODS:
        return False
    path = request.url.path
    if path in CSRF_EXEMPT_PATHS:
        return False
    return True
