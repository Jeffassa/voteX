"""Cloisonnement des élections par classe.

Un étudiant ne doit pouvoir consulter que les élections de sa propre classe.
Sans cette barrière, il suffisait de connaître un UUID d'élection pour lire le
détail et les résultats en direct de n'importe quelle promo.
"""

import pytest

from app.core.exceptions import NotFoundError
from app.models.student import UserRole
from app.services import election_service


def test_student_reads_election_of_own_class(db, voter, open_election):
    election = election_service.get_for_user(db, open_election.id, voter)
    assert election.id == open_election.id


def test_student_cannot_read_election_of_another_class(db, other_class_voter, open_election):
    with pytest.raises(NotFoundError):
        election_service.get_for_user(db, open_election.id, other_class_voter)


def test_student_without_class_is_denied(db, voter, open_election):
    voter.class_id = None
    db.commit()
    with pytest.raises(NotFoundError):
        election_service.get_for_user(db, open_election.id, voter)


def test_admin_reads_any_election(db, other_class_voter, open_election):
    other_class_voter.role = UserRole.ADMIN
    db.commit()
    election = election_service.get_for_user(db, open_election.id, other_class_voter)
    assert election.id == open_election.id


def test_voting_in_another_class_election_is_forbidden(db, other_class_voter, open_election):
    """Le refus doit venir de l'appartenance à la classe, pas d'autre chose.

    Vérifié en exécution le 30/08/2026 : l'API répond 403, et non 400 — ce
    dernier code signalerait un scrutin fermé et masquerait le contrôle.
    """
    from app.core.exceptions import ForbiddenError
    from app.services import vote_service

    with pytest.raises(ForbiddenError):
        vote_service.cast_vote(db, user=other_class_voter, election_id=open_election.id)


def test_unknown_election_is_not_found(db, voter):
    from uuid import uuid4

    with pytest.raises(NotFoundError):
        election_service.get_for_user(db, uuid4(), voter)
