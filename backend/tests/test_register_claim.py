"""Tests du flow de revendication d'un compte pré-importé."""

import pytest

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.core.security import hash_password
from app.models import Student
from app.models.student import UserRole
from app.schemas.auth import RegisterRequest
from app.services import auth_service


@pytest.fixture()
def pending_student(db, classroom):
    """Étudiant pré-importé sans password (en attente d'activation)."""
    s = Student(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        email=None,
        password_hash=None,  # ← non activé
        role=UserRole.STUDENT,
        class_id=classroom.id,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ─────────────────────────── happy path ───────────────────────────


def test_register_claims_pending_account(db, pending_student):
    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    user = auth_service.register_student(db, payload)

    assert user.id == pending_student.id
    assert user.is_activated is True
    assert user.password_hash is not None


def test_register_normalizes_matricule_case(db, pending_student):
    payload = RegisterRequest(
        matricule="22-esatic0273dn",  # minuscules → normalisé
        first_name="Aïcha",
        last_name="N'Guessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    user = auth_service.register_student(db, payload)
    assert user.id == pending_student.id


def test_register_name_match_is_accent_insensitive(db, pending_student):
    """'Aicha Nguessan' (sans accents/apostrophe) doit matcher 'Aïcha N'Guessan'."""
    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aicha",
        last_name="Nguessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    user = auth_service.register_student(db, payload)
    assert user.is_activated is True


# ─────────────────────────── format matricule ───────────────────────────


def test_register_invalid_matricule_format_rejected():
    """L'ancien format numérique (8 chiffres) n'est plus accepté."""
    with pytest.raises(ValueError):
        RegisterRequest(
            matricule="20240398",  # ancien format
            first_name="X",
            last_name="Y",
            password="my-secure-pass-12",
            confirm_password="my-secure-pass-12",
        )


def test_register_wrong_shape_but_right_length_rejected():
    """Bonne longueur, mauvais motif → c'est bien le validateur de format qui parle."""
    with pytest.raises(ValueError, match="invalide"):
        RegisterRequest(
            matricule="22-ESATIC12345A",  # 5 chiffres + 1 lettre
            first_name="X",
            last_name="Y",
            password="my-secure-pass-12",
            confirm_password="my-secure-pass-12",
        )


def test_register_matricule_format_too_short_rejected():
    with pytest.raises(ValueError):
        RegisterRequest(
            matricule="22-ESATIC1A",
            first_name="X",
            last_name="Y",
            password="my-secure-pass-12",
            confirm_password="my-secure-pass-12",
        )


def test_register_passwords_must_match():
    with pytest.raises(ValueError, match="ne correspondent pas"):
        RegisterRequest(
            matricule="22-ESATIC0273DN",
            first_name="Aïcha",
            last_name="N'Guessan",
            password="my-secure-pass-12",
            confirm_password="different-password-x",
        )


# ─────────────────────────── garde-fous ───────────────────────────


def test_register_unknown_matricule_creates_inactive_account(db):
    """Matricule absent de l'import : le compte est créé mais reste en salle d'attente.

    C'est le garde-fou du flux d'auto-inscription — sans validation admin,
    aucune connexion n'est possible.
    """
    payload = RegisterRequest(
        matricule="99-ESATIC9999ZZ",
        first_name="Inconnu",
        last_name="Person",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    user = auth_service.register_student(db, payload)
    assert user.is_active is False

    with pytest.raises(ForbiddenError, match="désactivé"):
        auth_service.authenticate(
            db, matricule="99-ESATIC9999ZZ", password="my-secure-pass-12"
        )


def test_register_already_activated_rejected(db, pending_student):
    """Un étudiant déjà inscrit ne peut pas re-revendiquer son compte."""
    pending_student.password_hash = hash_password("old-password")
    db.commit()

    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    with pytest.raises(ConflictError, match="déjà activé"):
        auth_service.register_student(db, payload)


def test_register_name_mismatch_rejected(db, pending_student):
    """Empêche un imposteur de revendiquer le matricule d'un autre étudiant."""
    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Imposteur",
        last_name="Quelqun",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    with pytest.raises(ValidationError, match="ne correspond pas"):
        auth_service.register_student(db, payload)


def test_claiming_a_disabled_account_does_not_grant_access(db, pending_student):
    """Revendiquer un compte désactivé n'ouvre aucune session.

    La revendication pose le mot de passe, mais `is_active` reste faux : la
    seule porte d'entrée reste la réactivation par un admin.
    """
    pending_student.is_active = False
    db.commit()

    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    user = auth_service.register_student(db, payload)
    assert user.is_active is False

    with pytest.raises(ForbiddenError, match="désactivé"):
        auth_service.authenticate(
            db, matricule="22-ESATIC0273DN", password="my-secure-pass-12"
        )


# ─────────────────────────── authenticate guard ───────────────────────────


def test_authenticate_pending_account_rejected(db, pending_student):
    """Un compte pré-importé sans mdp ne peut pas se connecter — message indicatif."""
    with pytest.raises(UnauthorizedError, match="non activé"):
        auth_service.authenticate(db, matricule="22-ESATIC0273DN", password="anything")


def test_authenticate_after_register_succeeds(db, pending_student):
    payload = RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        password="my-secure-pass-12",
        confirm_password="my-secure-pass-12",
    )
    auth_service.register_student(db, payload)

    user = auth_service.authenticate(
        db, matricule="22-ESATIC0273DN", password="my-secure-pass-12"
    )
    assert user.id == pending_student.id
