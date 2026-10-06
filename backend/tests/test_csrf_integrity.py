"""Protection CSRF sans cookie lisible par le script.

Le jeton n'est plus déposé dans un cookie que le JavaScript recopie : il est
scellé dans l'access token (httpOnly) et publié dans l'en-tête `X-CSRF-Token`
des réponses d'authentification. Le client le garde en mémoire.

Ce que ces tests vérifient : la mutation reste refusée sans jeton valide, le
jeton suit bien la rotation de session, et rien de tout cela ne transite par un
cookie accessible au script.
"""

from app.core.cookies import CSRF_HEADER


def _csrf(client) -> str:
    r = client.get("/api/auth/me")
    token = r.headers.get(CSRF_HEADER)
    assert token, "le serveur doit republier le jeton CSRF sur /me"
    return token


def test_login_publishes_the_token_in_a_header(client, voter):
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200, r.text
    assert r.headers.get(CSRF_HEADER)


def test_no_csrf_cookie_is_stored(auth_client):
    """Le cookie `sv_csrf` du double-submit ne doit plus être posé."""
    names = {c.name for c in auth_client.cookies.jar}
    assert "sv_csrf" not in names


def test_me_republishes_the_token(auth_client):
    """Après un rechargement de page, le client repart de /me pour l'obtenir."""
    assert _csrf(auth_client)


def test_mutation_without_token_is_rejected(auth_client):
    r = auth_client.post("/api/auth/sessions/revoke-all")
    assert r.status_code == 403, r.text


def test_mutation_with_forged_token_is_rejected(auth_client):
    r = auth_client.post(
        "/api/auth/sessions/revoke-all",
        headers={CSRF_HEADER: "jeton-fabrique-par-un-tiers"},
    )
    assert r.status_code == 403, r.text


def test_mutation_with_current_token_passes(auth_client):
    r = auth_client.post(
        "/api/auth/sessions/revoke-all", headers={CSRF_HEADER: _csrf(auth_client)}
    )
    assert r.status_code == 204, r.text


def test_refresh_rotates_the_token(auth_client):
    """La rotation de session change le jeton : il est lié à l'access token."""
    before = _csrf(auth_client)

    r = auth_client.post("/api/auth/refresh")
    assert r.status_code == 200, r.text
    issued = r.headers.get(CSRF_HEADER)
    assert issued and issued != before

    ok = auth_client.post("/api/auth/sessions/revoke-all", headers={CSRF_HEADER: issued})
    assert ok.status_code == 204, ok.text


def test_stale_token_is_rejected_after_refresh(auth_client):
    stale = _csrf(auth_client)
    assert auth_client.post("/api/auth/refresh").status_code == 200

    r = auth_client.post("/api/auth/sessions/revoke-all", headers={CSRF_HEADER: stale})
    assert r.status_code == 403, r.text


def test_bearer_clients_are_not_subject_to_csrf(client, voter):
    """Sans cookie de session, il n'y a pas d'autorité ambiante à protéger."""
    login = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    token = login.json()["access_token"]
    client.cookies.clear()

    r = client.post(
        "/api/auth/sessions/revoke-all",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204, r.text
