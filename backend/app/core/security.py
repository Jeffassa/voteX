"""JWT + hashing.

Tokens signés HS256 avec :
- iss / aud : identité de l'émetteur et destinataire (rejet si différent)
- exp / iat : durée de vie + horodatage
- sub : user_id (UUID en string)
- role : informatif (toujours re-vérifié en DB côté serveur)
- pwd_v : version du mot de passe (rejette les tokens émis avant un changement
  de mdp — invalidation cryptographique sans revocation list)
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import JWT_AUDIENCE, JWT_ISSUER, settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Claims sans lesquels un access token n'a aucun sens exploitable.
REQUIRED_CLAIMS = ("sub", "exp", "iat", "iss", "aud", "role", "pwd_v")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    *,
    subject: str | int,
    role: str,
    password_version: int,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "pwd_v": password_version,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": expire,
    }
    if extra:
        # On interdit l'override des claims sécurité critiques
        for k in extra:
            if k in {"sub", "iss", "aud", "exp", "iat", "pwd_v", "role"}:
                raise ValueError(f"Claim {k!r} est protégé et ne peut pas être surchargé")
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Vérifie signature + expiration + issuer + audience.

    Toute modification du payload invalide la signature → JWTError.
    Token expiré, mauvais issuer ou mauvaise audience → JWTError.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except JWTError as exc:
        raise ValueError(f"Token invalide : {exc}") from exc

    # python-jose ignore silencieusement l'option `require` (c'est une clé PyJWT).
    # On vérifie donc la présence des claims nous-mêmes, sinon un token forgé
    # sans `sub` passerait le décodage.
    missing = [claim for claim in REQUIRED_CLAIMS if payload.get(claim) is None]
    if missing:
        raise ValueError(f"Token invalide : claims manquants {missing}")
    return payload
