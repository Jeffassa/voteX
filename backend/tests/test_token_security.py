"""Tests des défenses sur les JWT.

Vérifie que :
- la signature détecte toute modification du payload
- les tokens expirés sont rejetés
- les tokens avec mauvais issuer/audience sont rejetés
- bump password_version invalide les tokens existants
- changement de rôle en DB invalide le token
- claims sécurité protégés (sub/iss/aud/exp/iat/pwd_v/role) ne peuvent pas être surchargés
- compte désactivé invalide le token
"""

import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt

from app.api.deps import get_current_user
from app.core.config import JWT_AUDIENCE, JWT_ISSUER, settings
from app.core.security import create_access_token, decode_token
from app.models.student import UserRole



def _auth(token: str | None, db):
    """Appelle get_current_user comme le ferait FastAPI.

    La dépendance lit d'abord le cookie `sv_access`, puis retombe sur le header
    Bearer. On lui passe donc une Request sans cookie et le token en header.
    """
    from starlette.requests import Request

    request = Request({"type": "http", "headers": [], "method": "GET", "path": "/"})
    return get_current_user(request, db, token)


# ─────────────────────────── création + claims ───────────────────────────


def test_token_contains_required_claims(voter):
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    payload = decode_token(token)
    assert payload["sub"] == str(voter.id)
    assert payload["role"] == voter.role.value
    assert payload["pwd_v"] == voter.password_version
    assert payload["iss"] == JWT_ISSUER
    assert payload["aud"] == JWT_AUDIENCE
    assert "exp" in payload
    assert "iat" in payload


def test_token_protects_critical_claims_from_override(voter):
    """On ne peut PAS injecter un sub/role/iss/aud/pwd_v via le paramètre `extra`."""
    for protected in ["sub", "role", "iss", "aud", "exp", "iat", "pwd_v"]:
        with pytest.raises(ValueError, match="protégé"):
            create_access_token(
                subject=voter.id,
                role=voter.role.value,
                password_version=voter.password_version,
                extra={protected: "hacked"},
            )


# ─────────────────────────── détection de modification ───────────────────────────


def _tamper_payload(token: str, mutation: dict) -> str:
    """Modifie le payload SANS re-signer — produit un token corrompu pour les tests."""
    header_b64, payload_b64, sig_b64 = token.split(".")
    payload_bytes = urlsafe_b64decode(payload_b64 + "==")
    payload = json.loads(payload_bytes)
    payload.update(mutation)
    new_payload_bytes = json.dumps(payload, separators=(",", ":")).encode()
    new_payload_b64 = urlsafe_b64encode(new_payload_bytes).rstrip(b"=").decode()
    return f"{header_b64}.{new_payload_b64}.{sig_b64}"


def test_modified_payload_invalidates_signature(voter):
    """Un attaquant qui change `role: student` → `role: admin` sans la clé secrète
    casse la signature."""
    token = create_access_token(
        subject=voter.id, role="student", password_version=voter.password_version
    )
    tampered = _tamper_payload(token, {"role": "super_admin"})
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(tampered)


def test_modified_subject_invalidates_signature(voter):
    """Changer le sub pour usurper un autre user → signature cassée."""
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    tampered = _tamper_payload(token, {"sub": str(uuid4())})
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(tampered)


def test_modified_pwd_version_invalidates_signature(voter):
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=1
    )
    tampered = _tamper_payload(token, {"pwd_v": 999})
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(tampered)


def test_modified_expiration_invalidates_signature(voter):
    """Tenter de prolonger artificiellement la durée de vie casse la signature."""
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    far_future = int((datetime.now(timezone.utc) + timedelta(days=365)).timestamp())
    tampered = _tamper_payload(token, {"exp": far_future})
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(tampered)


# ─────────────────────────── claims iss/aud ───────────────────────────


def test_wrong_audience_is_rejected():
    """Un token signé avec notre secret mais émis pour une autre app est rejeté."""
    payload = {
        "sub": str(uuid4()),
        "role": "student",
        "pwd_v": 1,
        "iss": JWT_ISSUER,
        "aud": "other-app",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(token)


def test_wrong_issuer_is_rejected():
    payload = {
        "sub": str(uuid4()),
        "role": "student",
        "pwd_v": 1,
        "iss": "rogue-issuer",
        "aud": JWT_AUDIENCE,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(token)


def test_missing_required_claim_is_rejected():
    """Token sans `sub` → rejeté à cause du options.require."""
    payload = {
        "role": "student",
        "pwd_v": 1,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(token)


# ─────────────────────────── expiration ───────────────────────────


def test_expired_token_is_rejected():
    payload = {
        "sub": str(uuid4()),
        "role": "student",
        "pwd_v": 1,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(ValueError, match="Token invalide"):
        decode_token(token)


# ─────────────────────────── validation côté get_current_user (DB) ───────────────────────────


def test_get_current_user_accepts_valid_token(db, voter):
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    user = _auth(token, db)
    assert user.id == voter.id


def test_get_current_user_rejects_token_after_password_change(db, voter):
    """Token émis avec pwd_v=1, puis password_version bumpé en DB à 2.
    Le token doit être rejeté."""
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    voter.password_version += 1
    db.commit()

    with pytest.raises(HTTPException) as exc:
        _auth(token, db)
    assert exc.value.status_code == 401
    assert "Session expirée" in exc.value.detail


def test_get_current_user_rejects_token_after_role_change(db, voter):
    """Token émis avec role=student, puis user promu admin en DB.
    Le token (role=student) ne doit plus être accepté."""
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    voter.role = UserRole.ADMIN
    db.commit()

    with pytest.raises(HTTPException) as exc:
        _auth(token, db)
    assert exc.value.status_code == 401
    assert "Rôle modifié" in exc.value.detail


def test_get_current_user_rejects_inactive_user(db, voter):
    token = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    voter.is_active = False
    db.commit()

    with pytest.raises(HTTPException) as exc:
        _auth(token, db)
    assert exc.value.status_code == 401


def test_get_current_user_rejects_unknown_subject(db, voter):
    """Token bien formé mais sub pointe vers un user qui n'existe pas (compte supprimé)."""
    fake_token = create_access_function_orphan(uuid4())
    with pytest.raises(HTTPException) as exc:
        _auth(fake_token, db)
    assert exc.value.status_code == 401


def create_access_function_orphan(uid):
    """Helper : crée un token pour un sub qui n'existe pas en DB."""
    return create_access_token(subject=uid, role="student", password_version=1)


def test_get_current_user_rejects_garbage_token(db):
    with pytest.raises(HTTPException) as exc:
        _auth("not-a-jwt", db)
    assert exc.value.status_code == 401


def test_get_current_user_rejects_tampered_token(db, voter):
    """Token avec role escaladé manuellement → signature cassée → rejet."""
    token = create_access_token(
        subject=voter.id, role="student", password_version=voter.password_version
    )
    tampered = _tamper_payload(token, {"role": "super_admin"})
    with pytest.raises(HTTPException) as exc:
        _auth(tampered, db)
    assert exc.value.status_code == 401


# ─────────────────────────── workflow complet ───────────────────────────


def test_password_change_workflow_invalidates_old_tokens(db, voter):
    """Scénario réaliste : utilisateur change son mdp, ses anciens tokens deviennent
    inutilisables immédiatement."""
    from app.services import auth_service

    token_before = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )

    # L'ancien token marche
    user = _auth(token_before, db)
    assert user.id == voter.id

    # Changement de mot de passe
    auth_service.change_password(
        db, user=voter, old_password="student12345", new_password="new-secure-pass-123"
    )

    # L'ancien token ne marche plus — fenêtre de vol fermée
    with pytest.raises(HTTPException) as exc:
        _auth(token_before, db)
    assert exc.value.status_code == 401

    # Un nouveau token avec le nouveau pwd_v fonctionne
    token_after = create_access_token(
        subject=voter.id, role=voter.role.value, password_version=voter.password_version
    )
    assert _auth(token_after, db).id == voter.id


# ─────────────────────────── validation du secret JWT ───────────────────────────


def test_short_jwt_secret_is_rejected(monkeypatch):
    """Au démarrage de l'app, un secret trop court doit lever une erreur."""
    from app.core.config import Settings

    monkeypatch.setenv("JWT_SECRET", "short")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    with pytest.raises(Exception, match="trop court"):
        Settings()


def test_obvious_dev_secret_is_rejected(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("JWT_SECRET", "this-is-my-dev-secret-change-me-please")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    with pytest.raises(Exception, match="démo"):
        Settings()
