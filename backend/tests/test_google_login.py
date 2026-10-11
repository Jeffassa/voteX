"""Connexion avec Google : Google prouve une adresse, jamais un droit de vote."""

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
import jwt

from app.core.config import settings
from app.models import AuditEvent
from app.services import google_oauth


CLIENT_ID = "smartvote-test.apps.googleusercontent.com"


@pytest.fixture(autouse=True)
def google_configured(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret-de-test")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://front.test")


def _id_token(**overrides):
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()),
        "email": "sekou.bamba@esatic.edu.ci",
        "email_verified": True,
    }
    claims.update(overrides)
    # Signature quelconque : le jeton arrive du point de terminaison token.
    return jwt.encode(claims, "cle-google-factice-assez-longue-pour-hs256", algorithm="HS256")


def _start(client):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code == 302
    params = parse_qs(urlparse(r.headers["location"]).query)
    return params["state"][0], params["nonce"][0]


def _callback(client, monkeypatch, state, token_claims, returned_state=None):
    monkeypatch.setattr(
        google_oauth, "exchange_code", lambda code, verifier: {"id_token": _id_token(**token_claims)}
    )
    return client.get(
        "/api/auth/google/callback",
        params={"code": "code-google", "state": returned_state or state},
        follow_redirects=False,
    )


def test_button_is_hidden_until_google_is_configured(client, monkeypatch):
    assert client.get("/api/auth/providers").json()["google"] is True
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    assert client.get("/api/auth/providers").json()["google"] is False
    assert client.get("/api/auth/google/start", follow_redirects=False).status_code == 404


def test_start_redirects_to_google_with_pkce_and_a_sealed_state(client):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    params = parse_qs(urlparse(r.headers["location"]).query)
    assert r.headers["location"].startswith(google_oauth.AUTHORIZE_URL)
    assert params["code_challenge_method"] == ["S256"]
    assert params["scope"] == ["openid email"]
    assert params["prompt"] == ["select_account"]
    cookie = r.headers["set-cookie"]
    assert "sv_oauth=" in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()


def test_verified_email_of_an_active_account_opens_a_session(client, monkeypatch, voter, db):
    voter.email = "Sekou.Bamba@esatic.edu.ci"  # la casse ne doit pas compter
    db.commit()
    state, nonce = _start(client)

    r = _callback(client, monkeypatch, state, {"nonce": nonce})

    assert r.status_code == 302
    assert r.headers["location"] == "http://front.test/connexion/google"
    assert "X-CSRF-Token" not in r.headers
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["matricule"] == voter.matricule
    assert db.query(AuditEvent).filter(AuditEvent.details == "google").count() == 1


def test_google_never_creates_a_voter(client, monkeypatch, db):
    state, nonce = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": nonce, "email": "inconnu@gmail.com"})
    assert r.headers["location"] == "http://front.test/login?erreur=google_aucun_compte"
    assert client.get("/api/auth/me").status_code == 401


def test_unverified_google_address_is_refused(client, monkeypatch, voter, db):
    voter.email = "sekou.bamba@esatic.edu.ci"
    db.commit()
    state, nonce = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": nonce, "email_verified": False})
    assert r.headers["location"].endswith("erreur=google_email_non_verifie")


def test_forged_state_is_refused(client, monkeypatch, voter, db):
    voter.email = "sekou.bamba@esatic.edu.ci"
    db.commit()
    state, nonce = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": nonce}, returned_state="etat-forge")
    assert r.headers["location"].endswith("erreur=google_session")
    assert client.get("/api/auth/me").status_code == 401


def test_token_for_another_application_is_refused(client, monkeypatch, voter, db):
    voter.email = "sekou.bamba@esatic.edu.ci"
    db.commit()
    state, nonce = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": nonce, "aud": "autre-appli"})
    assert r.headers["location"].endswith("erreur=google_google")


def test_replayed_nonce_is_refused(client, monkeypatch, voter, db):
    voter.email = "sekou.bamba@esatic.edu.ci"
    db.commit()
    state, _ = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": "nonce-d-une-autre-connexion"})
    assert r.headers["location"].endswith("erreur=google_session")


def test_pending_claim_cannot_be_opened_through_google(client, monkeypatch, voter, db):
    """Une revendication en attente de validation humaine reste fermée."""
    voter.email = "sekou.bamba@esatic.edu.ci"
    voter.is_active = False
    db.commit()
    state, nonce = _start(client)
    r = _callback(client, monkeypatch, state, {"nonce": nonce})
    assert r.headers["location"].endswith("erreur=google_compte_inactif")


def test_user_cancelling_on_google_returns_to_login(client):
    _start(client)
    r = client.get("/api/auth/google/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert r.headers["location"].endswith("erreur=google_annule")
