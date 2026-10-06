"""Garde-fous de la demande de code d'activation.

Le code ouvre la revendication d'un compte : il ne doit jamais partir vers une
adresse choisie par un tiers quand le compte a déjà un email rattaché.
"""

import pytest
from fastapi import BackgroundTasks

from app.core.exceptions import ValidationError
from app.models import Student
from app.models.student import UserRole
from app.schemas.auth import ActivationCodeRequest
from app.services import auth_service


@pytest.fixture()
def imported_student(db, classroom):
    s = Student(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        email=None,
        password_hash=None,
        role=UserRole.STUDENT,
        class_id=classroom.id,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _request(email: str) -> ActivationCodeRequest:
    return ActivationCodeRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        email=email,
    )


async def test_first_request_keeps_the_address_pending(db, imported_student):
    """L'adresse du demandeur reçoit le code, mais n'est pas rattachée au compte."""
    tasks = BackgroundTasks()
    await auth_service.send_activation_code(db, _request("Aicha@gmail.com"), tasks)

    db.refresh(imported_student)
    assert imported_student.email is None
    assert imported_student.pending_email == "aicha@gmail.com"
    assert imported_student.identity_verified is False
    assert imported_student.activation_code
    assert tasks.tasks[0].kwargs["to_email"] == "aicha@gmail.com"


async def test_asking_again_never_turns_the_requester_address_into_a_school_one(db, imported_student):
    """Redemander un code ne fait pas passer l'adresse du demandeur pour celle de l'école."""
    for _ in range(3):
        await auth_service.send_activation_code(db, _request("pirate@gmail.com"), BackgroundTasks())

    db.refresh(imported_student)
    assert imported_student.email is None
    assert imported_student.identity_verified is False


async def test_code_never_goes_to_an_attacker_supplied_address(db, imported_student):
    """Adresse issue de l'import : le code part vers elle, pas vers la saisie."""
    imported_student.email = "aicha@esatic.edu.ci"
    imported_student.identity_verified = True  # ce que fait l'import quand le fichier donne l'adresse
    db.commit()

    tasks = BackgroundTasks()
    await auth_service.send_activation_code(db, _request("pirate@gmail.com"), tasks)

    db.refresh(imported_student)
    assert imported_student.email == "aicha@esatic.edu.ci", "l'email en base ne doit pas bouger"
    assert tasks.tasks[0].kwargs["to_email"] == "aicha@esatic.edu.ci"


async def test_name_mismatch_sends_nothing_and_says_nothing(db, imported_student):
    """Même réponse qu'un succès : le nom n'est pas confirmé, rien ne part."""
    payload = ActivationCodeRequest(
        matricule="22-ESATIC0273DN",
        first_name="Imposteur",
        last_name="Quelqun",
        email="pirate@gmail.com",
    )
    tasks = BackgroundTasks()
    await auth_service.send_activation_code(db, payload, tasks)
    db.refresh(imported_student)
    assert tasks.tasks == [] and imported_student.activation_code is None


async def test_the_answer_does_not_reveal_the_account_state(client, db, imported_student, classroom):
    """Matricule inconnu, compte déjà activé, compte à activer : une seule réponse."""
    db.add(Student(
        matricule="22-ESATIC0274DN", first_name="Yao", last_name="Konan", password_hash="x",
        role=UserRole.STUDENT, class_id=classroom.id, is_active=True,
    ))
    db.commit()
    bodies = []
    for matricule, first, last in (
        ("99-ESATIC9999ZZ", "Personne", "Inconnu"),  # n'existe pas
        ("22-ESATIC0274DN", "Yao", "Konan"),          # déjà activé
        ("22-ESATIC0273DN", "Aïcha", "N'Guessan"),    # à activer
    ):
        r = client.post(
            "/api/auth/request-activation-code",
            json={"matricule": matricule, "first_name": first, "last_name": last, "email": "x@gmail.com"},
        )
        bodies.append((r.status_code, r.json()))
    assert bodies[0] == bodies[1] == bodies[2]


async def test_codes_are_limited_per_account(db, imported_student):
    """Un envoi par minute pour un même compte, quelle que soit l'adresse IP."""
    from app.core.rate_limit import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        first, second = BackgroundTasks(), BackgroundTasks()
        await auth_service.send_activation_code(db, _request("aicha@gmail.com"), first)
        db.refresh(imported_student)
        code = imported_student.activation_code
        await auth_service.send_activation_code(db, _request("aicha@gmail.com"), second)
        db.refresh(imported_student)
    finally:
        limiter.enabled = False
        limiter.reset()
    assert len(first.tasks) == 1 and second.tasks == []
    assert imported_student.activation_code == code, "le code ne doit pas tourner"


async def test_foreign_email_domain_is_rejected(db, imported_student):
    with pytest.raises(ValidationError, match="ESATIC"):
        await auth_service.send_activation_code(
            db, _request("pirate@mailinator.com"), BackgroundTasks()
        )
