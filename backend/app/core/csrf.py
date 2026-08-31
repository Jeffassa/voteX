"""Protection CSRF — jeton scellé dans l'access token.

Pourquoi ce n'est plus un double-submit cookie
----------------------------------------------
Le pattern classique dépose un cookie `sv_csrf` *lisible par le JavaScript*,
que le client recopie dans l'en-tête `X-CSRF-Token`. Il fonctionne, mais il
oblige à laisser en permanence une valeur de session accessible au script, donc
à toute extension et à tout XSS, sur une machine souvent partagée.

Ici, le jeton voyage autrement :

- le serveur tire une valeur aléatoire et la scelle dans l'access token, sous le
  claim `csrf`. L'access token vit dans un cookie httpOnly : le script ne peut
  ni le lire, ni le forger — il est signé ;
- la même valeur est renvoyée au client dans l'en-tête `X-CSRF-Token` des
  réponses d'authentification. Le client la garde EN MÉMOIRE, le temps de
  l'onglet, et la recopie dans ses requêtes mutatives ;
- à la vérification, le serveur relit le claim du cookie et le compare à
  l'en-tête reçu.

Ce qu'un attaquant cross-origin ne peut pas faire : lire le cookie (httpOnly),
lire l'en-tête de réponse (la politique CORS ne l'expose qu'aux origines
autorisées), ni deviner 256 bits d'aléa. Sa requête forgée partira avec le
cookie — les navigateurs les joignent automatiquement — mais sans l'en-tête.

Requêtes sans cookie de session
-------------------------------
Un client qui s'authentifie par `Authorization: Bearer` (CLI, scripts, Swagger)
ne présente aucune autorité ambiante : le navigateur d'une victime ne peut pas
émettre une telle requête en son nom. Il n'y a donc rien à protéger, et exiger
un en-tête CSRF n'ajouterait aucune sécurité tout en cassant ces clients.
"""

import hmac
import logging
import secrets

from fastapi import Request

from app.core.cookies import ACCESS_COOKIE, CSRF_HEADER
from app.core.security import decode_token


logger = logging.getLogger(__name__)

# Routes exemptées du check CSRF :
# - login/register : pas encore de session, aucun jeton n'a été émis
# - password-reset/* : flow public déclenché par l'utilisateur via email
# - refresh : protégé par la possession du refresh cookie (httpOnly, scopé
#   /api/auth) ; c'est lui qui délivre le prochain jeton CSRF
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

CSRF_CLAIM = "csrf"


def generate_csrf_token() -> str:
    """32 octets URL-safe = 256 bits d'entropie."""
    return secrets.token_urlsafe(32)


def verify_csrf(request: Request) -> bool:
    """Compare le claim `csrf` de l'access token à l'en-tête, en temps constant."""
    cookie_token = request.cookies.get(ACCESS_COOKIE)
    if not cookie_token:
        # Pas d'autorité ambiante : voir l'en-tête de module.
        return True

    header_value = request.headers.get(CSRF_HEADER)
    if not header_value:
        return False

    try:
        payload = decode_token(cookie_token)
    except ValueError:
        # Cookie expiré ou invalide : la dépendance d'authentification répondra
        # 401, ce qui est plus juste qu'un 403 CSRF trompeur.
        return True

    expected = payload.get(CSRF_CLAIM)
    if not expected:
        # Jeton émis avant l'introduction du claim : la session doit être
        # renouvelée plutôt que d'accepter une mutation non protégée.
        logger.info("csrf: access token sans claim %r — session à renouveler", CSRF_CLAIM)
        return False

    return hmac.compare_digest(str(expected), header_value)


def needs_csrf_check(request: Request) -> bool:
    if request.method not in CSRF_PROTECTED_METHODS:
        return False
    path = request.url.path
    if path in CSRF_EXEMPT_PATHS:
        return False
    return True
