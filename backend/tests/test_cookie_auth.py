"""Tests du flow d'auth cookie-based.

Couvre :
- /login → 3 cookies posés (access httpOnly, refresh httpOnly, csrf lisible)
- /me → fonctionne avec cookie OU header Bearer
- /logout → révoque + clear cookies
- /refresh → rotation, ancien token invalidé
- Détection de reuse → révoque toute la chaîne
- CSRF : POST sans header X-CSRF-Token rejeté
- CSRF : POST avec header mais cookie différent rejeté
"""

import pytest
from fastapi.testclient import TestClient

from app.core.cookies import ACCESS_COOKIE, CSRF_HEADER, REFRESH_COOKIE


def _csrf(client) -> str:
    """Récupère le jeton CSRF comme le fait le vrai client : par l'en-tête.

    Aucun cookie ne le porte plus — il est scellé dans l'access token httpOnly
    et republié sur /me, que le SPA appelle au chargement.
    """
    r = client.get("/api/auth/me")
    token = r.headers.get(CSRF_HEADER)
    assert token, "le serveur doit republier le jeton CSRF sur /me"
    return token
from app.core.database import get_db
from app.main import app
from app.models import RefreshToken


# ─────────────────────────── login → cookies ───────────────────────────


def test_login_sets_only_httponly_cookies(client, voter):
    """Deux cookies, tous deux httpOnly : rien n'est laissé au script."""
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200
    cookies = {c.name: c for c in client.cookies.jar}
    assert ACCESS_COOKIE in cookies
    assert REFRESH_COOKIE in cookies
    assert "sv_csrf" not in cookies, "le cookie CSRF lisible par le JS ne doit plus exister"

    # Le jeton CSRF arrive par l'en-tête, pas par un cookie.
    assert r.headers.get(CSRF_HEADER)


def test_login_access_cookie_is_httponly(client, voter):
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    set_cookie_headers = r.headers.get_list("set-cookie") if hasattr(r.headers, "get_list") else r.headers.raw
    # Convertir en string pour grep
    raw = " ".join(str(h) for h in set_cookie_headers).lower()
    assert "httponly" in raw  # au moins un cookie httpOnly


def test_no_cookie_is_readable_by_scripts(client, voter):
    """Chaque cookie posé doit être httpOnly.

    Un cookie lisible par le script est exposé à toute extension et à tout XSS,
    et survit à la fermeture de l'onglet sur une machine partagée. Le jeton CSRF
    passait par là ; il voyage désormais dans l'en-tête X-CSRF-Token.
    """
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200

    set_cookies = r.headers.get_list("set-cookie")
    posed = [h for h in set_cookies if not _is_deletion(h)]
    assert posed, "le login doit poser des cookies"
    for header in posed:
        assert "httponly" in header.lower(), f"cookie lisible par le JS : {header}"


def _is_deletion(set_cookie_header: str) -> bool:
    """Un cookie supprimé est réémis vide avec une expiration passée."""
    lowered = set_cookie_header.lower()
    return 'max-age=0' in lowered or '=""' in lowered or "expires=thu, 01 jan 1970" in lowered


def test_login_rejects_wrong_password(client, voter):
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "wrong"},
    )
    assert r.status_code == 401


# ─────────────────────────── /me avec cookie ───────────────────────────


def test_me_works_with_access_cookie(auth_client):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["matricule"] == "20240398"


def test_me_returns_401_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_works_with_bearer_header(client, voter):
    """Fallback CLI/Swagger : Authorization: Bearer marche aussi."""
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    token = r.json()["access_token"]

    # Nouveau client sans cookies
    fresh = TestClient(app)
    fresh.app.dependency_overrides = client.app.dependency_overrides
    r = fresh.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


# ─────────────────────────── refresh + rotation ───────────────────────────


def test_refresh_rotates_tokens(auth_client, db, voter):
    """Après /refresh, l'ancien refresh est révoqué et un nouveau est émis."""
    old_refresh = auth_client.cookies.get(REFRESH_COOKIE)
    assert old_refresh

    r = auth_client.post("/api/auth/refresh")
    assert r.status_code == 200

    new_refresh = auth_client.cookies.get(REFRESH_COOKIE)
    assert new_refresh != old_refresh

    # Le nouveau record en DB n'est pas révoqué
    active_tokens = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == voter.id, RefreshToken.revoked_at.is_(None))
        .all()
    )
    assert len(active_tokens) == 1


def test_refresh_without_cookie_is_401(client):
    r = client.post("/api/auth/refresh")
    assert r.status_code == 401


def test_refresh_with_revoked_token_is_rejected(auth_client, db, voter):
    """Replay d'un refresh token déjà rotaté → rejet."""
    old_refresh = auth_client.cookies.get(REFRESH_COOKIE)

    # Premier refresh : OK
    r1 = auth_client.post("/api/auth/refresh")
    assert r1.status_code == 200

    # Tenter de rejouer l'ancien refresh
    auth_client.cookies.set(REFRESH_COOKIE, old_refresh, path="/api/auth")
    r2 = auth_client.post("/api/auth/refresh")
    assert r2.status_code == 401


def test_refresh_reuse_revokes_all_sessions(auth_client, db, voter):
    """Detection de vol : si un token déjà révoqué est rejoué, on coupe TOUT."""
    old_refresh = auth_client.cookies.get(REFRESH_COOKIE)

    # Rotation normale
    auth_client.post("/api/auth/refresh")
    new_refresh = auth_client.cookies.get(REFRESH_COOKIE)

    # Replay de l'ancien (attaque)
    auth_client.cookies.set(REFRESH_COOKIE, old_refresh, path="/api/auth")
    auth_client.post("/api/auth/refresh")

    # Maintenant le NOUVEAU token (légitime) doit aussi être rejeté
    auth_client.cookies.set(REFRESH_COOKIE, new_refresh, path="/api/auth")
    r = auth_client.post("/api/auth/refresh")
    assert r.status_code == 401

    # Vérification DB : plus aucun token actif
    active = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == voter.id, RefreshToken.revoked_at.is_(None))
        .count()
    )
    assert active == 0


# ─────────────────────────── logout ───────────────────────────


def test_logout_revokes_refresh_and_clears_cookies(auth_client, db, voter):
    r = auth_client.post(
        "/api/auth/logout",
        headers={CSRF_HEADER: _csrf(auth_client)},
    )
    assert r.status_code == 204

    active = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == voter.id, RefreshToken.revoked_at.is_(None))
        .count()
    )
    assert active == 0


def test_logout_without_session_is_safe(client):
    """Logout sans cookie ne plante pas."""
    r = client.post("/api/auth/logout")
    # Pas de CSRF, mais logout est dans des routes exemptes ? Non — c'est protégé.
    # En l'absence de cookie CSRF + header, ça doit retourner 403.
    assert r.status_code in (204, 403)


# ─────────────────────────── CSRF protection ───────────────────────────


def test_post_without_csrf_header_is_rejected(auth_client):
    """Une mutation protégée doit avoir X-CSRF-Token."""
    r = auth_client.post(
        "/api/votes/",
        json={"election_id": "00000000-0000-0000-0000-000000000000",
              "candidate_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert r.status_code == 403
    assert "CSRF" in r.json()["detail"]


def test_post_with_mismatched_csrf_is_rejected(auth_client):
    """Header différent du cookie → rejet."""
    r = auth_client.post(
        "/api/votes/",
        json={"election_id": "00000000-0000-0000-0000-000000000000",
              "candidate_id": "00000000-0000-0000-0000-000000000000"},
        headers={"X-CSRF-Token": "attacker-supplied-value"},
    )
    assert r.status_code == 403


def test_post_with_valid_csrf_passes_csrf_check(auth_client, open_election):
    """Avec le bon header, la requête passe le check CSRF (échouera plus loin pour
    d'autres raisons mais pas pour CSRF)."""
    cand = open_election.candidates[0]
    csrf = _csrf(auth_client)
    r = auth_client.post(
        "/api/votes/",
        json={"election_id": str(open_election.id), "candidate_id": str(cand.id)},
        headers={"X-CSRF-Token": csrf},
    )
    # 201 (vote OK) ou 4xx métier — mais PAS 403 CSRF
    assert r.status_code != 403


def test_get_does_not_need_csrf(auth_client):
    """Les GET sont exemptés — pas besoin de header."""
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200


# ─────────────────────────── password change révoque tout ───────────────────────────


def test_change_password_revokes_all_sessions(auth_client, db, voter):
    csrf = _csrf(auth_client)
    r = auth_client.post(
        "/api/auth/me/change-password",
        json={"token": "student12345", "new_password": "new-secure-password-123"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200

    active = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == voter.id, RefreshToken.revoked_at.is_(None))
        .count()
    )
    assert active == 0


def test_revoke_all_sessions_kills_other_devices(client, voter):
    """Login depuis 'appareil A' et 'appareil B', puis revoke-all depuis A."""
    # Appareil A
    client_a = TestClient(app)
    client_a.app.dependency_overrides = client.app.dependency_overrides
    r = client_a.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200

    # Appareil B
    client_b = TestClient(app)
    client_b.app.dependency_overrides = client.app.dependency_overrides
    r = client_b.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200

    # Depuis A : panic button
    csrf_a = _csrf(client_a)
    r = client_a.post(
        "/api/auth/sessions/revoke-all",
        headers={"X-CSRF-Token": csrf_a},
    )
    assert r.status_code == 204

    # B essaie de refresh — doit échouer
    r = client_b.post("/api/auth/refresh")
    assert r.status_code == 401
