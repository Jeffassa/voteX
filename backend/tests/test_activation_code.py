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


async def test_first_request_registers_the_email(db, imported_student):
    tasks = BackgroundTasks()
    await auth_service.send_activation_code(db, _request("aicha@gmail.com"), tasks)

    db.refresh(imported_student)
    assert imported_student.email == "aicha@gmail.com"
    assert imported_student.activation_code
    assert tasks.tasks[0].kwargs["to_email"] == "aicha@gmail.com"


async def test_code_never_goes_to_an_attacker_supplied_address(db, imported_student):
    """Compte déjà rattaché : le code part vers l'adresse en base, pas la saisie."""
    imported_student.email = "aicha@esatic.edu.ci"
    db.commit()

    tasks = BackgroundTasks()
    await auth_service.send_activation_code(db, _request("pirate@gmail.com"), tasks)

    db.refresh(imported_student)
    assert imported_student.email == "aicha@esatic.edu.ci", "l'email en base ne doit pas bouger"
    assert tasks.tasks[0].kwargs["to_email"] == "aicha@esatic.edu.ci"


async def test_name_mismatch_is_rejected(db, imported_student):
    payload = ActivationCodeRequest(
        matricule="22-ESATIC0273DN",
        first_name="Imposteur",
        last_name="Quelqun",
        email="pirate@gmail.com",
    )
    with pytest.raises(ValidationError, match="ne correspond pas"):
        await auth_service.send_activation_code(db, payload, BackgroundTasks())


async def test_foreign_email_domain_is_rejected(db, imported_student):
    with pytest.raises(ValidationError, match="ESATIC"):
        await auth_service.send_activation_code(
            db, _request("pirate@mailinator.com"), BackgroundTasks()
        )
