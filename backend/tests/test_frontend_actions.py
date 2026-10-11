"""Chaque bouton d'action du site, rejoué par l'API.

Méthode, adresse et corps de requête sont ceux qu'envoie le frontend
(frontend/src/lib/queries/*.ts et les pages). La modification et la
suppression d'une classe renvoyaient 405 : l'interface les proposait, le
serveur n'avait pas les routes. Ce fichier garde les deux côtés d'accord.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest

from app.core.cookies import CSRF_HEADER
from app.core.security import hash_password
from app.models import ClassRoom, Student
from app.models.student import UserRole


def _iso(dt: datetime) -> str:
    """Comme Date.prototype.toISOString() côté navigateur."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _login(client, matricule: str, password: str) -> dict:
    r = client.post("/api/auth/login", data={"username": matricule, "password": password})
    assert r.status_code == 200, r.text
    return {CSRF_HEADER: r.headers[CSRF_HEADER]}


@pytest.fixture()
def boss(db):
    s = Student(
        matricule="SUPER1", first_name="Super", last_name="Admin", email="super1@esatic.edu.ci",
        password_hash=hash_password("admin12345"), role=UserRole.SUPER_ADMIN, is_active=True,
    )
    db.add(s)
    db.commit()
    return s


@pytest.fixture()
def admin_headers(client, boss):
    return _login(client, "SUPER1", "admin12345")


# ── Classes ───────────────────────────────────────────────────────────────

def test_class_buttons(client, db, admin_headers, voter, classroom):
    h = admin_headers

    r = client.post("/api/classes/", json={"name": "Réseaux", "level": "L2", "field": "Réseaux et télécoms"}, headers=h)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]

    # Bouton « Modifier » (crayon), puis « Enregistrer ».
    r = client.patch(f"/api/classes/{cid}", json={"name": "RTEL 2", "level": "L2", "field": "Réseaux"}, headers=h)
    assert r.status_code == 200, r.text
    assert (r.json()["name"], r.json()["field"]) == ("RTEL 2", "Réseaux")

    # Doublon et champ vide : un message, pas une erreur 500.
    r = client.patch(f"/api/classes/{cid}", json={"name": classroom.name, "level": classroom.level, "field": "x"}, headers=h)
    assert r.status_code == 409 and "existe déjà" in r.json()["detail"]
    r = client.patch(f"/api/classes/{cid}", json={"name": "   ", "level": "L2", "field": "x"}, headers=h)
    assert r.status_code == 400

    # Bouton « Supprimer » (corbeille) : refusé tant que la classe a des électeurs.
    r = client.delete(f"/api/classes/{classroom.id}", headers=h)
    assert r.status_code == 409 and "1 étudiant" in r.json()["detail"]

    r = client.delete(f"/api/classes/{cid}", headers=h)
    assert r.status_code == 204, r.text
    assert db.get(ClassRoom, UUID(cid)) is None

    actions = [e["action"] for e in client.get("/api/admin/audit", headers=h).json()]
    assert {"class_created", "class_updated", "class_deleted"} <= set(actions)


def test_class_buttons_need_an_admin(client, voter, classroom):
    h = _login(client, voter.matricule, "student12345")
    assert client.patch(f"/api/classes/{classroom.id}", json={"name": "x"}, headers=h).status_code == 403
    assert client.delete(f"/api/classes/{classroom.id}", headers=h).status_code == 403


# ── Élections et candidats ────────────────────────────────────────────────

def test_election_buttons(client, admin_headers, classroom, candidate_students, voter):
    h = admin_headers
    now = datetime.now(timezone.utc)

    # « Créer le brouillon »
    r = client.post("/api/elections/", json={
        "title": "Chef de classe, L3 GL", "description": None, "class_id": str(classroom.id),
        "starts_at": _iso(now - timedelta(minutes=5)), "ends_at": _iso(now + timedelta(days=1)),
    }, headers=h)
    assert r.status_code == 201, r.text
    eid = r.json()["id"]

    # « Modifier » puis « Enregistrer »
    r = client.patch(f"/api/elections/{eid}", json={
        "title": "Chef de classe 2026", "description": "Scrutin annuel", "class_id": str(classroom.id),
        "starts_at": _iso(now - timedelta(minutes=5)), "ends_at": _iso(now + timedelta(days=2)),
    }, headers=h)
    assert r.status_code == 200, r.text

    # « Ajouter un candidat » ×3, puis la corbeille sur l'un d'eux.
    ids = []
    for s in candidate_students:
        r = client.post("/api/candidates/", json={
            "election_id": eid, "student_id": str(s.id), "slogan": "Une voix", "program": "Point 1\nPoint 2", "biography": None,
        }, headers=h)
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    assert client.delete(f"/api/candidates/{ids[-1]}", headers=h).status_code == 204
    assert len(client.get(f"/api/candidates/election/{eid}", headers=h).json()) == 2

    # « Ouvrir le scrutin », un vote, « Clôturer le scrutin ».
    r = client.post(f"/api/elections/{eid}/open", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "open", r.text
    assert client.get(f"/api/elections/{eid}/non-voters", headers=h).status_code == 200

    vh = _login(client, voter.matricule, "student12345")
    r = client.post("/api/votes/", json={"election_id": eid, "candidate_id": ids[0]}, headers=vh)
    assert r.status_code == 201, r.text

    h = _login(client, "SUPER1", "admin12345")
    r = client.post(f"/api/elections/{eid}/close", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "closed", r.text
    results = client.get(f"/api/elections/{eid}/results", headers=h).json()
    assert results["total_votes"] == 1 and not results.get("scores_hidden")

    # « Supprimer définitivement » : refusé quand des votes existent (la page
    # ne propose alors plus le bouton), accepté pour un brouillon.
    assert client.delete(f"/api/elections/{eid}", headers=h).status_code == 409
    r = client.post("/api/elections/", json={
        "title": "Brouillon jetable", "description": None, "class_id": str(classroom.id),
        "starts_at": _iso(now + timedelta(hours=1)), "ends_at": _iso(now + timedelta(days=1)),
    }, headers=h)
    assert client.delete(f"/api/elections/{r.json()['id']}", headers=h).status_code == 204


# ── Étudiants et salle d'attente ─────────────────────────────────────────

def test_student_buttons(client, db, admin_headers, classroom):
    h = admin_headers

    # « Inscrire un étudiant »
    r = client.post("/api/students/", json={
        "matricule": "24-ESATIC0777AB", "first_name": "Awa", "last_name": "Koné",
        "email": "awa.kone@esatic.edu.ci", "class_id": str(classroom.id),
    }, headers=h)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    # Menu « … » : Modifier, Désactiver, Réactiver.
    r = client.patch(f"/api/students/{sid}", json={"first_name": "Awa", "last_name": "Koné Diallo", "class_id": str(classroom.id)}, headers=h)
    assert r.status_code == 200, r.text
    assert client.patch(f"/api/students/{sid}", json={"is_active": False}, headers=h).json()["is_active"] is False
    assert client.patch(f"/api/students/{sid}", json={"is_active": True}, headers=h).json()["is_active"] is True

    # Donner puis retirer les droits d'administration.
    assert client.post(f"/api/students/{sid}/role", json={"role": "admin"}, headers=h).json()["role"] == "admin"
    assert client.post(f"/api/students/{sid}/role", json={"role": "student"}, headers=h).json()["role"] == "student"

    # Recherche et filtre de classe.
    r = client.get("/api/students/", params={"search": "koné", "class_id": str(classroom.id)}, headers=h)
    assert [s["id"] for s in r.json()] == [sid]

    # « Supprimer »
    assert client.delete(f"/api/students/{sid}", headers=h).status_code == 204
    assert db.get(Student, UUID(sid)) is None


def test_waiting_room_buttons(client, db, admin_headers, classroom):
    h = admin_headers
    pending = [
        Student(matricule=f"24-ESATIC08{i}0AB", first_name="En", last_name=f"Attente{i}", class_id=classroom.id,
                role=UserRole.STUDENT, is_active=False, password_hash=hash_password("mot-de-passe-1"))
        for i in range(2)
    ]
    db.add_all(pending)
    db.commit()

    listed = {s["id"] for s in client.get("/api/admin/pending-students", headers=h).json()}
    assert {str(s.id) for s in pending} <= listed

    # « Autoriser » et « Refuser »
    assert client.patch(f"/api/admin/activate-student/{pending[0].id}", headers=h).status_code == 200
    assert client.patch(f"/api/admin/reject-claim/{pending[1].id}", headers=h).status_code == 200


def test_admin_screens_load(client, admin_headers):
    h = admin_headers
    for url in ("/api/admin/dashboard", "/api/admin/audit?limit=8", "/api/admin/pending-students",
                "/api/classes/", "/api/elections/", "/api/students/"):
        assert client.get(url, headers=h).status_code == 200, url


# ── Électeur ──────────────────────────────────────────────────────────────

def test_voter_buttons(client, open_election, voter):
    h = _login(client, voter.matricule, "student12345")

    # Bulletin : vote blanc, puis reçu et vérification publique.
    r = client.post("/api/votes/", json={"election_id": str(open_election.id), "candidate_id": None}, headers=h)
    assert r.status_code == 201, r.text
    receipt = r.json()
    # L'historique dit « a participé », sans réexposer l'empreinte du bulletin.
    mine = client.get("/api/votes/me", headers=h).json()
    assert [v["election_id"] for v in mine] == [str(open_election.id)]
    assert receipt["vote_hash"] not in {v["vote_hash"] for v in mine}
    assert client.get(f"/api/votes/verify/{receipt['vote_hash']}").json()["valid"] is True

    # Profil, sessions, cookies.
    assert client.patch("/api/students/me/profile", json={"photo_url": None}, headers=h).status_code == 200
    assert client.get("/api/auth/sessions", headers=h).status_code == 200
    assert client.put("/api/consent", json={"analytics": False}, headers=h).status_code == 200
    assert client.post("/api/analytics", json={"kind": "page", "name": "/"}, headers=h).status_code == 204

    # « Changer le mot de passe » : l'ancien voyage dans `token`.
    r = client.post("/api/auth/me/change-password", json={"token": "student12345", "new_password": "nouveau-mdp-2026"}, headers=h)
    assert r.status_code == 200, r.text
    _login(client, voter.matricule, "nouveau-mdp-2026")
