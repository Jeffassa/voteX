"""Revendication d'un compte importé, et essais répétés de mots de passe.

Ces tests décrivent une attaque plausible, pas une exigence abstraite : sur une
promotion, matricule et nom sont connus de tous — listes d'appel, copies,
badges. Le système ne doit pas traiter ces informations comme un secret.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import BackgroundTasks

from app.core.cookies import CSRF_HEADER
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import hash_password
from app.models import Student
from app.models.student import UserRole
from app.schemas.auth import ActivationCodeRequest, RegisterRequest
from app.services import auth_service


def _importe(db, classroom, *, email=None, identity_verified=False, code=None):
    """Un compte tel que l'import Excel le crée : sans mot de passe."""
    s = Student(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        email=email,
        activation_code=code,
        password_hash=None,
        role=UserRole.STUDENT,
        class_id=classroom.id,
        is_active=True,
        identity_verified=identity_verified,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _revendication(**extra):
    return RegisterRequest(
        matricule="22-ESATIC0273DN",
        first_name="Aïcha",
        last_name="N'Guessan",
        password="mot-de-passe-du-pirate",
        confirm_password="mot-de-passe-du-pirate",
        **extra,
    )


# ───────────────────────── revendication ─────────────────────────


def test_claim_without_proof_lands_in_the_waiting_room(db, classroom):
    """Matricule + nom ne suffisent pas : le compte n'est pas utilisable.

    C'est le scénario démontré sur la base réelle : deux requêtes suffisaient
    à prendre le compte d'un camarade, qui se retrouvait ensuite bloqué.
    """
    cible = _importe(db, classroom)  # aucun email connu de l'école

    user = auth_service.register_student(db, _revendication())

    assert user.id == cible.id
    assert user.is_activated is True, "le mot de passe est posé"
    assert user.is_active is False, "mais le compte attend une validation humaine"

    # Le refus vient de `is_active` : un compte en salle d'attente ne se
    # connecte pas, même avec le bon mot de passe.
    with pytest.raises(ForbiddenError, match="désactivé"):
        auth_service.authenticate(
            db, matricule="22-ESATIC0273DN", password="mot-de-passe-du-pirate"
        )


def test_claim_backed_by_a_school_address_is_immediate(db, classroom):
    """Adresse issue du fichier de l'école : aucune validation manuelle."""
    _importe(db, classroom, email="aicha@esatic.edu.ci", identity_verified=True)

    user = auth_service.register_student(db, _revendication())

    assert user.is_active is True
    assert auth_service.authenticate(
        db, matricule="22-ESATIC0273DN", password="mot-de-passe-du-pirate"
    ).id == user.id


async def test_a_code_sent_to_a_self_chosen_address_proves_nothing(db, classroom):
    """Le compte n'a pas d'adresse : celle du demandeur ne vaut pas preuve.

    Recevoir un code dans SA propre boîte démontre qu'on sait lire son courrier,
    rien de plus. La revendication reste soumise à validation.
    """
    _importe(db, classroom)

    await auth_service.send_activation_code(
        db,
        ActivationCodeRequest(
            matricule="22-ESATIC0273DN",
            first_name="Aïcha",
            last_name="N'Guessan",
            email="pirate@gmail.com",
        ),
        BackgroundTasks(),
    )

    cible = db.query(Student).filter(Student.matricule == "22-ESATIC0273DN").first()
    assert cible.identity_verified is False
    assert cible.activation_code

    user = auth_service.register_student(
        db, _revendication(activation_code=cible.activation_code)
    )
    assert user.is_active is False, "le code ne compense pas l'absence de canal fiable"


async def test_a_code_sent_to_the_known_address_proves_identity(db, classroom):
    """Adresse déjà en base : recevoir le code prouve l'accès à cette boîte."""
    _importe(db, classroom, email="aicha@esatic.edu.ci")

    await auth_service.send_activation_code(
        db,
        ActivationCodeRequest(
            matricule="22-ESATIC0273DN",
            first_name="Aïcha",
            last_name="N'Guessan",
            email="aicha@esatic.edu.ci",
        ),
        BackgroundTasks(),
    )

    cible = db.query(Student).filter(Student.matricule == "22-ESATIC0273DN").first()
    assert cible.identity_verified is True

    user = auth_service.register_student(
        db, _revendication(activation_code=cible.activation_code)
    )
    assert user.is_active is True


# ───────────────────────── essais répétés ─────────────────────────


def test_repeated_failures_lock_the_account(db, voter):
    """Le verrou porte sur le compte visé, pas sur l'adresse IP."""
    for _ in range(5):
        with pytest.raises(UnauthorizedError):
            auth_service.authenticate(db, matricule=voter.matricule, password="faux")

    db.refresh(voter)
    assert voter.failed_login_count >= 5
    assert voter.locked_until is not None

    # Même le bon mot de passe est refusé pendant le blocage : sans cela, un
    # attaquant qui trouve le mot de passe au cinquième essai passerait quand même.
    with pytest.raises(UnauthorizedError, match="Trop de tentatives"):
        auth_service.authenticate(db, matricule=voter.matricule, password="student12345")


def test_lock_expires_and_a_success_clears_the_counter(db, voter):
    """Le blocage est temporaire, et une réussite remet le compteur à zéro."""
    voter.failed_login_count = 5
    voter.locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)  # expiré
    db.commit()

    user = auth_service.authenticate(db, matricule=voter.matricule, password="student12345")

    assert user.id == voter.id
    db.refresh(voter)
    assert voter.failed_login_count == 0
    assert voter.locked_until is None


def test_a_few_mistakes_do_not_lock_anyone_out(db, voter):
    """Se tromper trois fois de mot de passe reste sans conséquence."""
    for _ in range(3):
        with pytest.raises(UnauthorizedError):
            auth_service.authenticate(db, matricule=voter.matricule, password="faux")

    db.refresh(voter)
    assert voter.locked_until is None
    assert auth_service.authenticate(
        db, matricule=voter.matricule, password="student12345"
    ).id == voter.id


# ───────────────────────── refus d'une revendication ─────────────────────────


def _csrf(client) -> str:
    """Jeton CSRF de la session en cours, republié par /me."""
    token = client.get("/api/auth/me").headers.get(CSRF_HEADER)
    assert token, "le serveur doit republier le jeton CSRF"
    return token


@pytest.fixture()
def admin_client(client, db, voter):
    """Client authentifié en administrateur."""
    voter.role = UserRole.ADMIN
    db.commit()
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200, r.text
    return client


def test_rejecting_a_claim_frees_the_account(db, admin_client, classroom):
    """Le point qui manquait : refuser doit rendre le compte au titulaire.

    Bloquer l'imposteur ne suffit pas. Si sa tentative laisse le compte marqué
    « déjà activé », l'étudiant légitime est écarté de son propre scrutin — le
    vol devient un déni de service. Après refus, le compte doit être exactement
    dans l'état où l'import l'avait laissé.
    """
    cible = _importe(db, classroom)
    auth_service.register_student(db, _revendication(email="pirate@gmail.com"))
    db.refresh(cible)
    assert cible.is_active is False, "la revendication non prouvée doit attendre"

    r = admin_client.patch(
        f"/api/admin/reject-claim/{cible.id}", headers={CSRF_HEADER: _csrf(admin_client)}
    )
    assert r.status_code == 200, r.text

    db.refresh(cible)
    assert cible.password_hash is None, "le mot de passe du demandeur doit disparaître"
    assert cible.email is None, "l'adresse choisie par le demandeur ne doit pas rester"
    assert cible.is_active is True
    assert cible.is_activated is False, "le compte doit redevenir revendicable"

    # Ce que tout cela sert à garantir : le titulaire peut recommencer.
    legitime = auth_service.register_student(db, _revendication())
    assert legitime.id == cible.id


def test_rejecting_an_active_account_is_refused(db, admin_client, voter):
    """Le refus ne doit pas devenir une façon détournée de purger un compte actif."""
    r = admin_client.patch(
        f"/api/admin/reject-claim/{voter.id}", headers={CSRF_HEADER: _csrf(admin_client)}
    )
    assert r.status_code == 400, r.text
    db.refresh(voter)
    assert voter.password_hash is not None


def test_rejecting_a_claim_needs_an_admin(client, db, classroom, voter):
    """Un étudiant ne libère pas les comptes de ses camarades."""
    cible = _importe(db, classroom)
    auth_service.register_student(db, _revendication())
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200
    # Avec un jeton CSRF valide : le refus ne peut alors venir que du rôle.
    r = client.patch(
        f"/api/admin/reject-claim/{cible.id}", headers={CSRF_HEADER: _csrf(client)}
    )
    assert r.status_code == 403, r.text
    assert "CSRF" not in r.text, "le refus doit porter sur le rôle, pas sur le jeton"


def test_a_password_reset_lifts_the_lock(db, voter):
    """Le message affiché renvoie vers « mot de passe oublié » : il doit dire vrai.

    Un compte verrouillé dont la réinitialisation ne lèverait pas le verrou
    laisserait son titulaire sans issue jusqu'à expiration — et le message
    d'erreur serait un mensonge.
    """
    voter.failed_login_count = 9
    voter.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.commit()

    token = auth_service._create_reset_token(voter.id, voter.password_version)
    auth_service.confirm_password_reset(db, token=token, new_password="nouveau-mot-de-passe-1")

    db.refresh(voter)
    assert voter.locked_until is None
    assert voter.failed_login_count == 0
    # Et la porte s'ouvre vraiment.
    assert auth_service.authenticate(db, voter.matricule, "nouveau-mot-de-passe-1").id == voter.id
