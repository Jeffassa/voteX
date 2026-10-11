"""Consentement, mesure d'audience, anti-spam et HTTPS forcé."""

from app.core import metrics
from app.core.config import settings


def _value(counter, **labels):
    return counter.labels(**labels)._value.get()


# ─────────────── consentement ───────────────


def test_consent_is_unknown_until_the_visitor_answers(client):
    assert client.get("/api/consent").json() == {"analytics": None}


def test_consent_choice_is_kept_in_an_httponly_cookie(client):
    r = client.put("/api/consent", json={"analytics": True})
    assert r.status_code == 200
    set_cookie = r.headers["set-cookie"]
    assert "sv_consent=analytics=1" in set_cookie.replace('"', "")
    assert "HttpOnly" in set_cookie
    assert client.get("/api/consent").json() == {"analytics": True}

    client.put("/api/consent", json={"analytics": False})
    assert client.get("/api/consent").json() == {"analytics": False}


# ─────────────── mesure d'audience ───────────────


def test_hits_are_ignored_without_consent(client):
    before = _value(metrics.PAGE_VIEWS_TOTAL, page="landing")
    r = client.post("/api/analytics", json={"kind": "page", "name": "landing"})
    assert r.status_code == 204
    assert _value(metrics.PAGE_VIEWS_TOTAL, page="landing") == before


def test_hits_are_counted_after_consent(client):
    client.put("/api/consent", json={"analytics": True})
    before = _value(metrics.PAGE_VIEWS_TOTAL, page="landing")
    client.post("/api/analytics", json={"kind": "page", "name": "landing"})
    assert _value(metrics.PAGE_VIEWS_TOTAL, page="landing") == before + 1


def test_unknown_names_never_become_labels(client):
    client.put("/api/consent", json={"analytics": True})
    client.post("/api/analytics", json={"kind": "page", "name": "/elections/1234-uuid"})
    labels = {s.labels.get("page") for m in metrics.PAGE_VIEWS_TOTAL.collect() for s in m.samples}
    assert "/elections/1234-uuid" not in labels


# ─────────────── anti-spam ───────────────


def test_honeypot_on_password_reset_answers_neutrally_without_acting(client, monkeypatch):
    from app.services import auth_service

    called = []
    monkeypatch.setattr(auth_service, "request_password_reset", lambda *a, **k: called.append(1))
    r = client.post(
        "/api/auth/password-reset/request",
        json={"email": "x@esatic.edu.ci", "website": "http://spam.example"},
    )
    assert r.status_code == 202
    assert called == []


def test_honeypot_on_login_does_not_lock_the_targeted_account(client, voter, db):
    for _ in range(12):
        r = client.post(
            "/api/auth/login",
            data={"username": voter.matricule, "password": "nope", "website": "bot"},
        )
        assert r.status_code == 401
    db.refresh(voter)
    assert voter.failed_login_count == 0
    ok = client.post("/api/auth/login", data={"username": voter.matricule, "password": "student12345"})
    assert ok.status_code == 200


def test_honeypot_on_register_is_refused(client):
    r = client.post(
        "/api/auth/register",
        json={
            "matricule": "24-ESATIC0398SB", "first_name": "A", "last_name": "B",
            "password": "student12345", "confirm_password": "student12345",
            "website": "x",
        },
    )
    assert r.status_code == 400


# ─────────────── HTTPS forcé ───────────────


def test_plain_http_is_redirected_when_https_is_forced(client, monkeypatch):
    monkeypatch.setattr(settings, "FORCE_HTTPS", True)
    r = client.post("/api/auth/login", data={"username": "x", "password": "y"}, follow_redirects=False)
    assert r.status_code == 308
    assert r.headers["location"].startswith("https://")


def test_health_probes_stay_reachable_in_clear(client, monkeypatch):
    monkeypatch.setattr(settings, "FORCE_HTTPS", True)
    assert client.get("/healthz").status_code == 200


def test_https_responses_carry_hsts(db, monkeypatch):
    from fastapi.testclient import TestClient

    from app.core.database import get_db
    from app.main import app

    monkeypatch.setattr(settings, "FORCE_HTTPS", True)
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app, base_url="https://testserver") as c:
            r = c.get("/api/consent")
        assert "max-age=" in r.headers["strict-transport-security"]
    finally:
        app.dependency_overrides.clear()
