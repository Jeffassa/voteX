"""Connexion avec Google (OpenID Connect, flux « authorization code » + PKCE).

Tout se passe côté serveur : la page ne charge aucun script Google (la CSP
reste `script-src 'self'`) et aucun jeton Google ne transite par le navigateur.

    navigateur → GET /api/auth/google/start
               ← 302 accounts.google.com (state, nonce, code_challenge)
    Google     → GET /api/auth/google/callback?code=…&state=…
    serveur    → POST oauth2.googleapis.com/token (code + code_verifier + secret)
               ← id_token
               → cookies de session SmartVote, puis 302 vers le frontend

Règle d'accès
-------------
Google ne CRÉE jamais d'électeur : la liste électorale vient de l'école. Une
connexion Google aboutit seulement si un compte existant, actif et déjà activé
porte exactement l'adresse que Google déclare vérifiée. C'est le même niveau de
preuve qu'un lien de réinitialisation envoyé à cette adresse.

Vérification du jeton
---------------------
L'id_token est reçu directement du point de terminaison `token` de Google, sur
une connexion TLS que nous avons ouverte. OpenID Connect Core (§ 3.1.3.7)
admet alors la validation TLS à la place de la vérification de signature. Les
revendications, elles, sont toutes contrôlées : émetteur, audience, expiration,
nonce et `email_verified`.
"""

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Student


logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = frozenset({"accounts.google.com", "https://accounts.google.com"})

STATE_COOKIE = "sv_oauth"
STATE_COOKIE_PATH = "/api/auth/google"
STATE_TTL = timedelta(minutes=10)
_STATE_AUDIENCE = "esatic-smartvote-oauth-state"


class GoogleLoginError(Exception):
    """Échec de connexion. `code` est repris dans l'URL de retour du frontend."""

    def __init__(self, code: str, log_detail: str = ""):
        super().__init__(code)
        self.code = code
        self.log_detail = log_detail


@dataclass(frozen=True)
class AuthorizationRequest:
    url: str
    state_cookie: str


def is_enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def redirect_uri() -> str:
    return settings.GOOGLE_REDIRECT_URI


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=")
    return verifier, challenge.decode()


def start() -> AuthorizationRequest:
    """Prépare la redirection vers Google et le cookie qui la scelle."""
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()

    # state, nonce et code_verifier voyagent dans un cookie httpOnly signé et
    # daté : rien à stocker côté serveur, et un cookie forgé ou périmé échoue.
    sealed = jwt.encode(
        {
            "state": state,
            "nonce": nonce,
            "cv": verifier,
            "aud": _STATE_AUDIENCE,
            "exp": datetime.now(timezone.utc) + STATE_TTL,
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        # Sur un poste partagé, ne jamais réutiliser d'office le compte Google
        # resté ouvert par l'utilisateur précédent.
        "prompt": "select_account",
    }
    return AuthorizationRequest(url=f"{AUTHORIZE_URL}?{urlencode(params)}", state_cookie=sealed)


def _open_state(cookie: str | None, returned_state: str | None) -> dict:
    if not cookie or not returned_state:
        raise GoogleLoginError("session", "cookie d'état ou paramètre state absent")
    try:
        data = jwt.decode(
            cookie, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience=_STATE_AUDIENCE
        )
    except JWTError as exc:
        raise GoogleLoginError("session", f"cookie d'état invalide : {exc}") from exc
    if not secrets.compare_digest(str(data.get("state", "")), returned_state):
        raise GoogleLoginError("session", "state différent : requête forgée ou rejouée")
    return data


def exchange_code(code: str, code_verifier: str) -> dict:
    """Échange le code contre les jetons. Isolé pour être remplacé en test."""
    response = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
        timeout=10,
    )
    if response.status_code != 200:
        raise GoogleLoginError("google", f"échange du code refusé ({response.status_code})")
    return response.json()


def _verified_email(id_token: str, expected_nonce: str) -> str:
    try:
        claims = jwt.get_unverified_claims(id_token)
    except JWTError as exc:
        raise GoogleLoginError("google", f"id_token illisible : {exc}") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleLoginError("google", f"émetteur inattendu {claims.get('iss')!r}")
    aud = claims.get("aud")
    if aud != settings.GOOGLE_CLIENT_ID and not (isinstance(aud, list) and settings.GOOGLE_CLIENT_ID in aud):
        raise GoogleLoginError("google", "audience différente de notre client_id")
    if int(claims.get("exp", 0)) < datetime.now(timezone.utc).timestamp():
        raise GoogleLoginError("google", "id_token expiré")
    if not secrets.compare_digest(str(claims.get("nonce", "")), expected_nonce):
        raise GoogleLoginError("session", "nonce différent")
    if claims.get("email_verified") is not True or not claims.get("email"):
        raise GoogleLoginError("email_non_verifie", "adresse Google non vérifiée")
    return str(claims["email"]).strip().lower()


def complete(db: Session, *, code: str | None, state: str | None, state_cookie: str | None) -> Student:
    """Termine la connexion : retourne l'électeur, ou lève GoogleLoginError."""
    if not code:
        raise GoogleLoginError("annule", "retour sans code (connexion annulée ?)")
    sealed = _open_state(state_cookie, state)
    tokens = exchange_code(code, sealed["cv"])
    email = _verified_email(tokens.get("id_token", ""), sealed["nonce"])

    user = db.query(Student).filter(func.lower(Student.email) == email).first()
    if user is None:
        raise GoogleLoginError("aucun_compte", f"aucun compte pour {email}")
    if not user.is_active:
        raise GoogleLoginError("compte_inactif", f"compte {user.matricule} inactif")
    if not user.is_activated:
        raise GoogleLoginError("non_active", f"compte {user.matricule} jamais activé")
    return user
