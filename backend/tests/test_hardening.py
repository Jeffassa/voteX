"""Durcissements issus de l'audit : origine des requêtes, cloisonnement, fuites."""

from app.core.config import settings
from app.core.cookies import CSRF_HEADER


def _login(client, matricule, origin=None):
    headers = {"Origin": origin} if origin else {}
    return client.post(
        "/api/auth/login", data={"username": matricule, "password": "student12345"}, headers=headers
    )


def test_a_foreign_page_cannot_log_a_voter_into_another_account(client, voter):
    """Connexion forcée : le formulaire posté depuis un autre site est refusé."""
    r = _login(client, voter.matricule, origin="https://site-pirate.example")
    assert r.status_code == 403
    assert "sv_access" not in r.cookies


def test_the_frontend_and_command_line_clients_still_log_in(client, voter):
    assert _login(client, voter.matricule, origin=settings.FRONTEND_URL).status_code == 200
    assert _login(client, voter.matricule).status_code == 200  # pas d'en-tête Origin


def test_a_candidate_of_another_class_is_not_found(client, db, open_election, other_class_voter):
    other_class_voter.is_active = True
    db.commit()
    r = client.post(
        "/api/auth/login", data={"username": other_class_voter.matricule, "password": "student12345"}
    )
    assert r.status_code == 200
    cand = open_election.candidates[0]
    assert client.get(f"/api/candidates/{cand.id}").status_code == 404


def test_readiness_probe_does_not_publish_database_errors(client):
    from app.core.database import get_db
    from app.main import app

    class _Broken:
        def execute(self, *_a, **_k):
            raise RuntimeError("connexion refusée à postgres://smartvote:secret@db-interne:5432")

    app.dependency_overrides[get_db] = lambda: _Broken()
    r = client.get("/readyz")
    assert r.status_code == 503
    assert "secret" not in r.text and "db-interne" not in r.text


def test_disconnect_everywhere_cuts_access_tokens_already_issued(client, voter):
    token = _login(client, voter.matricule).json()["access_token"]
    stolen = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/auth/me", headers=stolen).status_code == 200

    csrf = client.get("/api/auth/me").headers[CSRF_HEADER]
    assert client.post("/api/auth/sessions/revoke-all", headers={CSRF_HEADER: csrf}).status_code == 204

    client.cookies.clear()
    assert client.get("/api/auth/me", headers=stolen).status_code == 401


def test_photos_hosted_elsewhere_are_refused_unless_the_school_allows_the_host(auth_client, monkeypatch):
    """Une photo extérieure enverrait l'adresse IP de chaque visiteur à cet hébergeur."""
    csrf = auth_client.get("/api/auth/me").headers[CSRF_HEADER]

    def patch(url):
        return auth_client.patch(
            "/api/students/me/profile", json={"photo_url": url}, headers={CSRF_HEADER: csrf}
        )

    assert patch("https://pisteur.example/pixel.gif").status_code == 422
    monkeypatch.setattr(settings, "PHOTO_ALLOWED_HOSTS", "photos.esatic.ci")
    assert patch("https://pisteur.example/pixel.gif").status_code == 422
    assert patch("http://photos.esatic.ci/a.jpg").status_code == 422  # https seulement
    assert patch("https://photos.esatic.ci/a.jpg").status_code == 200
    assert patch(None).status_code == 200  # retirer sa photo reste possible
