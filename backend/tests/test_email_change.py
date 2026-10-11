"""Adresse e-mail saisie par l'étudiant : jamais appliquée sans confirmation.

L'adresse d'un compte ouvre la connexion Google et reçoit les liens de
réinitialisation. Une adresse non confirmée donnerait le compte au
propriétaire de la boîte saisie (faute de frappe, ou session restée ouverte
détournée).
"""

import pytest

from app.core.cookies import CSRF_HEADER
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.models import Student
from app.schemas.auth import RegisterRequest
from app.schemas.student import StudentSelfUpdate
from app.services import auth_service, email_change_service, email_service, student_service


class _Outbox:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, kwargs))

    def links(self):
        return [k["confirm_url"] for fn, k in self.tasks if fn is email_service.send_email_confirmation_email]


def _token_from(url: str) -> str:
    return url.split("#token=", 1)[1]


@pytest.fixture()
def unactivated(db, classroom):
    s = Student(
        matricule="24-ESATIC0500AB",
        first_name="Awa",
        last_name="Kouassi",
        email="awa.kouassi@esatic.edu.ci",
        class_id=classroom.id,
        is_active=True,
        identity_verified=True,
        activation_code="ABC123",
    )
    db.add(s)
    db.commit()
    return s


def _register(db, outbox, email):
    return auth_service.register_student(
        db,
        RegisterRequest(
            matricule="24-ESATIC0500AB", first_name="Awa", last_name="Kouassi",
            password="motdepasse1", confirm_password="motdepasse1",
            activation_code="ABC123", email=email,
        ),
        outbox,
    )


# ─────────────── à l'activation ───────────────


def test_personal_email_at_activation_waits_for_confirmation(db, unactivated):
    outbox = _Outbox()
    user = _register(db, outbox, "awa.perso@gmail.com")

    assert user.email == "awa.kouassi@esatic.edu.ci"  # l'adresse de l'école reste en place
    assert user.pending_email == "awa.perso@gmail.com"
    assert len(outbox.links()) == 1

    confirmed, previous = email_change_service.confirm(db, token=_token_from(outbox.links()[0]))
    assert confirmed.email == "awa.perso@gmail.com"
    assert confirmed.pending_email is None
    assert previous == "awa.kouassi@esatic.edu.ci"


def test_activation_without_personal_email_sends_nothing(db, unactivated):
    outbox = _Outbox()
    user = _register(db, outbox, None)
    assert user.pending_email is None and outbox.links() == []


def test_taken_address_is_refused_before_activating(db, unactivated, voter):
    voter.email = "deja.pris@gmail.com"
    db.commit()
    with pytest.raises(ConflictError):
        _register(db, _Outbox(), "Deja.Pris@gmail.com")
    db.refresh(unactivated)
    assert unactivated.password_hash is None  # le compte n'a pas été activé à moitié


# ─────────────── depuis le profil ───────────────


def test_profile_change_requires_current_password(db, voter):
    with pytest.raises(UnauthorizedError):
        student_service.update_self(
            db, user=voter, payload=StudentSelfUpdate(email="autre@gmail.com"), background_tasks=_Outbox()
        )
    with pytest.raises(UnauthorizedError):
        student_service.update_self(
            db, user=voter,
            payload=StudentSelfUpdate(email="autre@gmail.com", current_password="mauvais"),
            background_tasks=_Outbox(),
        )
    db.refresh(voter)
    assert voter.pending_email is None


def test_profile_change_is_pending_until_confirmed(db, voter):
    before = voter.email
    outbox = _Outbox()
    student_service.update_self(
        db, user=voter,
        payload=StudentSelfUpdate(email="nouvelle@gmail.com", current_password="student12345"),
        background_tasks=outbox,
    )
    db.refresh(voter)
    assert voter.email == before and voter.pending_email == "nouvelle@gmail.com"
    email_change_service.confirm(db, token=_token_from(outbox.links()[0]))
    db.refresh(voter)
    assert voter.email == "nouvelle@gmail.com"


def test_a_newer_request_invalidates_the_older_link(db, voter):
    outbox = _Outbox()
    for address in ("premiere@gmail.com", "seconde@gmail.com"):
        student_service.update_self(
            db, user=voter,
            payload=StudentSelfUpdate(email=address, current_password="student12345"),
            background_tasks=outbox,
        )
    first, second = outbox.links()
    with pytest.raises(ValidationError):
        email_change_service.confirm(db, token=_token_from(first))
    user, _ = email_change_service.confirm(db, token=_token_from(second))
    assert user.email == "seconde@gmail.com"


def test_forged_link_is_refused(db, voter):
    with pytest.raises(ValidationError):
        email_change_service.confirm(db, token="pas-un-jeton-valide-du-tout")


def test_address_taken_meanwhile_is_refused_at_confirmation(db, voter, other_class_voter):
    outbox = _Outbox()
    student_service.update_self(
        db, user=voter,
        payload=StudentSelfUpdate(email="convoitee@gmail.com", current_password="student12345"),
        background_tasks=outbox,
    )
    other_class_voter.email = "convoitee@gmail.com"
    db.commit()
    with pytest.raises(ConflictError):
        email_change_service.confirm(db, token=_token_from(outbox.links()[0]))


# ─────────────── par l'API ───────────────


def test_confirmation_endpoint_applies_the_address_and_warns_the_old_one(client, voter, db, monkeypatch):
    notices = []
    monkeypatch.setattr(email_service, "send_email_changed_notice", lambda **k: notices.append(k))
    outbox = _Outbox()
    old = voter.email
    email_change_service.request_change(db, user=voter, new_email="via.api@gmail.com", background_tasks=outbox)

    r = client.post("/api/auth/email/confirm", json={"token": _token_from(outbox.links()[0])})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "via.api@gmail.com"
    assert notices and notices[0]["to_email"] == old


def test_me_exposes_the_pending_address(auth_client, voter, db):
    voter.pending_email = "en.attente@gmail.com"
    db.commit()
    me = auth_client.get("/api/auth/me").json()
    assert me["pending_email"] == "en.attente@gmail.com"


def test_profile_endpoint_rejects_email_change_without_password(auth_client):
    csrf = auth_client.get("/api/auth/me").headers[CSRF_HEADER]
    r = auth_client.patch(
        "/api/students/me/profile", json={"email": "pirate@gmail.com"}, headers={CSRF_HEADER: csrf}
    )
    assert r.status_code == 401
