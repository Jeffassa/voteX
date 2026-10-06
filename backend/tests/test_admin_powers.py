"""Ce qu'un administrateur ne peut pas faire.

Un admin gère la liste électorale : il ne doit pas pouvoir prendre un compte
de rang supérieur, ni se glisser dans le compte d'un électeur pour voter à sa
place. Les deux passaient par l'adresse e-mail, qui ouvre le compte
(réinitialisation du mot de passe, connexion Google).
"""

import pytest

from app.core.cookies import CSRF_HEADER
from app.core.exceptions import ForbiddenError
from app.core.security import hash_password
from app.models import Student
from app.models.student import UserRole
from app.schemas.student import StudentUpdate
from app.services import auth_service, email_service, student_service


class _Outbox:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, kwargs))


def _account(db, matricule, role, **extra):
    s = Student(
        matricule=matricule, first_name="Prénom", last_name=matricule.title(),
        email=f"{matricule.lower()}@esatic.edu.ci", password_hash=hash_password("mot-de-passe-1"),
        role=role, is_active=True, **extra,
    )
    db.add(s)
    db.commit()
    return s


@pytest.fixture()
def admin(db):
    return _account(db, "ADMIN1", UserRole.ADMIN)


@pytest.fixture()
def boss(db):
    return _account(db, "SUPER1", UserRole.SUPER_ADMIN)


def test_admin_cannot_take_over_a_super_admin(db, admin, boss):
    """L'attaque de l'audit : réécrire l'adresse du super-admin, puis la réinitialiser."""
    with pytest.raises(ForbiddenError):
        student_service.update(db, boss.id, StudentUpdate(email="pirate@gmail.com"), actor=admin)
    with pytest.raises(ForbiddenError):
        student_service.update(db, boss.id, StudentUpdate(is_active=False), actor=admin)
    with pytest.raises(ForbiddenError):
        student_service.delete(db, boss.id, current_user_id=admin.id)
    db.refresh(boss)
    assert boss.email == "super1@esatic.edu.ci" and boss.is_active
    assert auth_service.request_password_reset(db, email="pirate@gmail.com") is None


def test_admin_cannot_touch_another_admin(db, admin):
    other = _account(db, "ADMIN2", UserRole.ADMIN)
    with pytest.raises(ForbiddenError):
        student_service.update(db, other.id, StudentUpdate(first_name="X"), actor=admin)


def test_super_admin_still_manages_admins(db, admin, boss):
    student_service.update(db, admin.id, StudentUpdate(is_active=False), actor=boss)
    db.refresh(admin)
    assert admin.is_active is False


def test_admin_cannot_put_his_address_on_a_voter_account(db, admin, voter):
    """Sur un compte activé, la nouvelle adresse attend la confirmation de son titulaire."""
    outbox = _Outbox()
    student_service.update(
        db, voter.id, StudentUpdate(email="admin.perso@gmail.com"), actor=admin, background_tasks=outbox
    )
    db.refresh(voter)
    assert voter.email == "sekou@esatic.ci", "l'adresse de l'électeur ne doit pas changer"
    assert voter.pending_email == "admin.perso@gmail.com"
    # Le lien part vers la nouvelle adresse : l'admin peut le recevoir, mais
    # l'ancienne adresse sera prévenue à la confirmation, et le journal le garde.
    assert [fn for fn, _ in outbox.tasks] == [email_service.send_email_confirmation_email]
    assert auth_service.request_password_reset(db, email="admin.perso@gmail.com") is None


def test_admin_fixes_the_address_of_an_account_not_yet_activated(db, admin, classroom):
    pending = Student(
        matricule="24-ESATIC0100AB", first_name="Awa", last_name="Kouassi",
        class_id=classroom.id, is_active=True, activation_code="ABC123",
    )
    db.add(pending)
    db.commit()

    student_service.update(db, pending.id, StudentUpdate(email="Awa.Kouassi@esatic.edu.ci"), actor=admin)

    db.refresh(pending)
    # Correction de la liste électorale : l'adresse vient de l'école.
    assert pending.email == "awa.kouassi@esatic.edu.ci"
    assert pending.identity_verified is True


def test_admin_creates_an_account_without_any_password(client, db, voter, classroom):
    voter.role = UserRole.ADMIN
    db.commit()
    login = client.post("/api/auth/login", data={"username": voter.matricule, "password": "student12345"})
    csrf = login.headers[CSRF_HEADER]

    r = client.post(
        "/api/students/",
        json={
            "matricule": "24-esatic0101ab", "first_name": "Yao", "last_name": "Konan",
            "email": "yao.konan@esatic.edu.ci", "class_id": str(classroom.id),
        },
        headers={CSRF_HEADER: csrf},
    )
    assert r.status_code == 201, r.text
    created = db.query(Student).filter(Student.matricule == "24-ESATIC0101AB").first()
    assert created.password_hash is None, "aucun mot de passe connu de l'administrateur"
    assert created.activation_code and created.identity_verified and created.is_active
    assert r.json()["is_activated"] is False


def test_a_student_cannot_create_accounts(auth_client, classroom):
    csrf = auth_client.get("/api/auth/me").headers[CSRF_HEADER]
    r = auth_client.post(
        "/api/students/",
        json={"matricule": "24-ESATIC0102AB", "first_name": "A", "last_name": "B", "class_id": str(classroom.id)},
        headers={CSRF_HEADER: csrf},
    )
    assert r.status_code == 403
