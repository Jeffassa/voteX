"""Tests de la couche auth — register + authenticate.

Invariants couverts :
- pas de doublons matricule / email
- mdp est bien hashé (pas stocké en clair)
- compte désactivé → forbidden
- mauvais mdp → unauthorized
"""

import pytest

from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import verify_password
from app.models.student import UserRole
from app.schemas.auth import RegisterRequest
from app.services import auth_service


# ─────────────────────────── register ───────────────────────────


def test_register_new_matricule_lands_in_waiting_room(db, classroom):
    """Une auto-inscription crée un compte INACTIF : l'admin doit le valider."""
    payload = RegisterRequest(
        matricule="22-ESATIC0777AB",
        first_name="Test",
        last_name="User",
        email="test@esatic.ci",
        password="secure-pass-12",
        confirm_password="secure-pass-12",
        class_id=str(classroom.id),
    )
    user = auth_service.register_student(db, payload)

    assert user.id is not None
    assert user.role == UserRole.STUDENT
    assert user.is_active is False, "un compte auto-inscrit ne doit pas être actif d'emblée"
    assert user.is_activated is True, "le mot de passe est bien posé"
    assert user.class_id == classroom.id
    # Le mot de passe ne doit JAMAIS être stocké en clair
    assert user.password_hash != "secure-pass-12"
    assert verify_password("secure-pass-12", user.password_hash) is True


def test_register_rejects_already_activated_matricule(db, voter):
    payload = RegisterRequest(
        matricule="22-ESATIC0398CD",
        first_name="Other",
        last_name="Person",
        email="other@esatic.ci",
        password="secure-pass-12",
        confirm_password="secure-pass-12",
    )
    voter.matricule = "22-ESATIC0398CD"
    db.commit()

    with pytest.raises(ConflictError, match="déjà activé"):
        auth_service.register_student(db, payload)


def test_register_rejects_duplicate_email(db, voter):
    payload = RegisterRequest(
        matricule="22-ESATIC9999EF",
        first_name="Other",
        last_name="Person",
        email=voter.email,
        password="secure-pass-12",
        confirm_password="secure-pass-12",
    )
    with pytest.raises(ConflictError, match="Email"):
        auth_service.register_student(db, payload)


def test_register_without_class_id_is_allowed(db):
    payload = RegisterRequest(
        matricule="22-ESATIC8888GH",
        first_name="Solo",
        last_name="Student",
        email="solo@esatic.ci",
        password="secure-pass-12",
        confirm_password="secure-pass-12",
        class_id=None,
    )
    user = auth_service.register_student(db, payload)
    assert user.class_id is None


# ─────────────────────────── authenticate ───────────────────────────


def test_authenticate_with_correct_credentials(db, voter):
    user = auth_service.authenticate(db, matricule="20240398", password="student12345")
    assert user.id == voter.id


def test_authenticate_wrong_password_raises(db, voter):
    with pytest.raises(UnauthorizedError, match="incorrect"):
        auth_service.authenticate(db, matricule=voter.matricule, password="wrong-pass")


def test_authenticate_unknown_matricule_raises(db):
    with pytest.raises(UnauthorizedError, match="incorrect"):
        auth_service.authenticate(db, matricule="00000000", password="whatever12")


def test_authenticate_inactive_account_raises(db, voter):
    voter.is_active = False
    db.commit()
    with pytest.raises(ForbiddenError, match="désactivé"):
        auth_service.authenticate(db, matricule=voter.matricule, password="student12345")


def test_authenticate_does_not_leak_user_existence(db, voter):
    """Le message d'erreur doit être identique pour matricule inconnu et mauvais mdp,
    pour ne pas permettre d'énumérer les comptes existants."""
    try:
        auth_service.authenticate(db, matricule="UNKNOWN", password="x")
    except UnauthorizedError as e1:
        msg_unknown = e1.message

    try:
        auth_service.authenticate(db, matricule=voter.matricule, password="x")
    except UnauthorizedError as e2:
        msg_wrong = e2.message

    assert msg_unknown == msg_wrong
