"""Intégrité du jeton CSRF sur la durée d'une session.

Le double-submit ne tient que si le cookie `sv_csrf` posé par le serveur reste
celui que le client renvoie en header. Ces tests vérifient les deux moments où
le serveur réémet le jeton — login et refresh — et le comportement attendu
d'un client qui n'a pas suivi la réémission.
"""

from app.core.cookies import CSRF_COOKIE, CSRF_HEADER


def test_csrf_cookie_is_issued_at_login(client, voter):
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200, r.text
    assert client.cookies.get(CSRF_COOKIE)


def test_mutation_passes_with_current_csrf_cookie(auth_client):
    """Le jeton courant autorise une mutation : on ne doit PAS être bloqué en 403."""
    csrf = auth_client.cookies.get(CSRF_COOKIE)
    r = auth_client.post(
        "/api/auth/me/change-password",
        json={"token": "student12345", "new_password": "nouveau-mdp-12"},
        headers={CSRF_HEADER: csrf},
    )
    assert r.status_code != 403, r.text


def test_refresh_reissues_a_usable_csrf_token(auth_client):
    """Après rotation, le nouveau cookie CSRF doit être celui qui fait autorité."""
    before = auth_client.cookies.get(CSRF_COOKIE)

    r = auth_client.post("/api/auth/refresh")
    assert r.status_code == 200, r.text

    after = auth_client.cookies.get(CSRF_COOKIE)
    assert after and after != before, "le refresh doit réémettre un jeton CSRF"

    ok = auth_client.post(
        "/api/auth/sessions/revoke-all", headers={CSRF_HEADER: after}
    )
    assert ok.status_code == 204, ok.text


def test_stale_csrf_token_is_rejected_after_refresh(auth_client):
    """Un client qui rejoue l'ancien jeton après rotation est refusé."""
    stale = auth_client.cookies.get(CSRF_COOKIE)
    assert auth_client.post("/api/auth/refresh").status_code == 200

    r = auth_client.post(
        "/api/auth/sessions/revoke-all", headers={CSRF_HEADER: stale}
    )
    assert r.status_code == 403, r.text
