"""Tests de election_service — CRUD, state machine, contraintes admin.

Invariants critiques couverts :
- update et delete bloqués si l'élection n'est pas en draft (ou closed sans votes)
- ouvrir une élection appelle bien la blockchain (mock)
- list_for_user filtre par classe pour les étudiants, retourne tout pour admins
- get_active_for_user retourne uniquement les élections ouvertes de la classe du user
- compute_results calcule pourcentages et participation correctement
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Election, Vote
from app.models.election import ElectionStatus
from app.models.student import UserRole
from app.schemas.election import ElectionCreate, ElectionUpdate
from app.services import election_service, vote_service


# ─────────────────────────── list / get ───────────────────────────


def test_list_for_student_filters_by_class(db, voter, open_election, other_class_voter):
    # voter est dans la classe de open_election — il doit le voir
    elections = election_service.list_for_user(db, voter)
    assert any(e.id == open_election.id for e in elections)

    # other_class_voter est dans une autre classe — il ne doit PAS le voir
    others = election_service.list_for_user(db, other_class_voter)
    assert not any(e.id == open_election.id for e in others)


def test_list_for_admin_returns_all_elections(db, voter, open_election, other_class_voter):
    voter.role = UserRole.ADMIN
    db.commit()
    elections = election_service.list_for_user(db, voter)
    # L'admin voit l'élection même si elle n'est pas dans sa classe
    assert any(e.id == open_election.id for e in elections)


def test_get_active_for_user_returns_open_election(db, voter, open_election):
    active = election_service.get_active_for_user(db, voter)
    assert active is not None
    assert active.id == open_election.id


def test_get_active_for_user_skips_draft_elections(db, voter, draft_election):
    # voter est dans la classe de draft_election mais elle n'est pas open
    active = election_service.get_active_for_user(db, voter)
    assert active is None


def test_get_active_for_user_returns_none_if_no_class(db, voter, open_election):
    voter.class_id = None
    db.commit()
    assert election_service.get_active_for_user(db, voter) is None


def test_get_or_404_raises_on_unknown(db):
    with pytest.raises(NotFoundError, match="Élection"):
        election_service.get_or_404(db, uuid4())


# ─────────────────────────── create ───────────────────────────


def test_create_election_happy_path(db, classroom):
    now = datetime.now(timezone.utc)
    payload = ElectionCreate(
        title="Test",
        description=None,
        class_id=classroom.id,
        starts_at=now,
        ends_at=now + timedelta(days=1),
    )
    election = election_service.create(db, payload)
    assert election.id is not None
    assert election.status == ElectionStatus.DRAFT
    assert election.blockchain_id is None


def test_create_election_rejects_invalid_period(db, classroom):
    now = datetime.now(timezone.utc)
    payload = ElectionCreate(
        title="Test",
        class_id=classroom.id,
        starts_at=now + timedelta(days=2),
        ends_at=now + timedelta(days=1),  # ends before starts
    )
    with pytest.raises(ValidationError, match="date de fin"):
        election_service.create(db, payload)


# ─────────────────────────── update ───────────────────────────


def test_update_election_in_draft_succeeds(db, draft_election):
    payload = ElectionUpdate(title="Nouveau titre")
    updated = election_service.update(db, draft_election.id, payload)
    assert updated.title == "Nouveau titre"


def test_update_election_open_is_rejected(db, open_election):
    payload = ElectionUpdate(title="Hack")
    with pytest.raises(ValidationError, match="brouillon"):
        election_service.update(db, open_election.id, payload)


def test_update_election_partial_fields_only(db, draft_election):
    """Un PATCH avec juste {title} ne doit pas écraser les autres champs."""
    original_class_id = draft_election.class_id
    original_starts = draft_election.starts_at

    payload = ElectionUpdate(title="Juste le titre")
    updated = election_service.update(db, draft_election.id, payload)

    assert updated.title == "Juste le titre"
    assert updated.class_id == original_class_id
    assert updated.starts_at == original_starts


def test_update_election_invalid_period_rejected(db, draft_election):
    payload = ElectionUpdate(
        starts_at=draft_election.ends_at,
        ends_at=draft_election.starts_at,
    )
    with pytest.raises(ValidationError, match="date de fin"):
        election_service.update(db, draft_election.id, payload)


# ─────────────────────────── delete ───────────────────────────


def test_delete_draft_election_succeeds(db, draft_election):
    election_id = draft_election.id
    election_service.delete(db, election_id)
    assert db.query(Election).filter(Election.id == election_id).first() is None


def test_delete_open_election_is_rejected(db, open_election):
    with pytest.raises(ConflictError, match="ouverte"):
        election_service.delete(db, open_election.id)


def test_delete_closed_election_without_votes_succeeds(db, draft_election):
    draft_election.status = ElectionStatus.CLOSED
    db.commit()
    election_service.delete(db, draft_election.id)
    assert (
        db.query(Election).filter(Election.id == draft_election.id).first() is None
    )


def test_delete_election_with_votes_is_rejected(db, voter, open_election):
    cand = open_election.candidates[0]
    vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand.id)

    # Force CLOSED puis tente delete
    open_election.status = ElectionStatus.CLOSED
    db.commit()
    with pytest.raises(ConflictError, match="votes"):
        election_service.delete(db, open_election.id)


# ─────────────────────────── set_status (state machine + blockchain) ───────────────────────────


@patch("app.services.election_service.blockchain")
def test_set_status_open_calls_blockchain(mock_chain, db, draft_election):
    mock_chain.create_election_on_chain.return_value = 42
    mock_chain.open_election_on_chain.return_value = True

    updated = election_service.set_status(db, draft_election.id, ElectionStatus.OPEN)

    assert updated.status == ElectionStatus.OPEN
    assert updated.blockchain_id == 42
    mock_chain.create_election_on_chain.assert_called_once()
    mock_chain.open_election_on_chain.assert_called_once_with(42)


@patch("app.services.election_service.blockchain")
def test_set_status_open_skips_chain_create_if_already_mapped(mock_chain, db, draft_election):
    """Si l'élection a déjà un blockchain_id, on ne re-crée pas (idempotent)."""
    draft_election.blockchain_id = 7
    db.commit()
    mock_chain.open_election_on_chain.return_value = True

    election_service.set_status(db, draft_election.id, ElectionStatus.OPEN)

    mock_chain.create_election_on_chain.assert_not_called()
    mock_chain.open_election_on_chain.assert_called_once_with(7)


@patch("app.services.election_service.blockchain")
def test_set_status_open_handles_chain_failure(mock_chain, db, draft_election):
    """Si la blockchain échoue, l'élection passe quand même à OPEN en DB
    (best-effort, dégradation propre)."""
    mock_chain.create_election_on_chain.return_value = None  # chain unavailable

    updated = election_service.set_status(db, draft_election.id, ElectionStatus.OPEN)

    assert updated.status == ElectionStatus.OPEN
    assert updated.blockchain_id is None  # pas de mapping mais pas de crash


@patch("app.services.election_service.blockchain")
def test_set_status_closed_calls_blockchain_close(mock_chain, db, open_election):
    open_election.blockchain_id = 99
    db.commit()

    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)

    mock_chain.close_election_on_chain.assert_called_once_with(99)


@patch("app.services.election_service.blockchain")
def test_set_status_closed_no_chain_call_if_no_blockchain_id(mock_chain, db, open_election):
    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)
    mock_chain.close_election_on_chain.assert_not_called()


@patch("app.services.election_service.blockchain")
def test_set_status_open_idempotent_does_not_recall_chain(mock_chain, db, open_election):
    """Repasser une élection déjà OPEN à OPEN ne doit pas rappeler la blockchain."""
    election_service.set_status(db, open_election.id, ElectionStatus.OPEN)
    mock_chain.create_election_on_chain.assert_not_called()
    mock_chain.open_election_on_chain.assert_not_called()


# ─────────────────────────── compute_results ───────────────────────────


def test_compute_results_with_no_votes(db, open_election):
    results = election_service.compute_results(db, open_election.id)
    assert results.total_votes == 0
    assert results.participation_rate == 0
    # Tous les candidats à 0%
    assert all(c.votes == 0 for c in results.candidates)
    assert all(c.percentage == 0 for c in results.candidates)


def test_compute_results_calculates_percentages(db, voter, candidate_students, open_election):
    """3 votes total : voter→cand0, candidate_student[0]→cand0, candidate_student[1]→cand1.
    Cand0 = 66.67%, Cand1 = 33.33%, Cand2 = 0%."""
    cand0 = open_election.candidates[0]
    cand1 = open_election.candidates[1]

    vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand0.id)
    vote_service.cast_vote(
        db, user=candidate_students[0], election_id=open_election.id, candidate_id=cand0.id
    )
    vote_service.cast_vote(
        db, user=candidate_students[1], election_id=open_election.id, candidate_id=cand1.id
    )

    results = election_service.compute_results(db, open_election.id)
    assert results.total_votes == 3
    # Triés par votes desc
    assert results.candidates[0].votes == 2
    assert results.candidates[0].percentage == round(2 / 3 * 100, 2)
    assert results.candidates[1].votes == 1


def test_compute_results_eligible_count_matches_class(db, voter, candidate_students, open_election):
    """total_eligible = nombre d'étudiants actifs dans la classe de l'élection."""
    results = election_service.compute_results(db, open_election.id)
    # voter + 3 candidate_students = 4 étudiants dans la classe
    assert results.total_eligible == 4


def test_compute_results_sorts_candidates_by_votes_desc(db, voter, candidate_students, open_election):
    cand2 = open_election.candidates[2]
    # Donne tous les votes au 3e candidat
    vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand2.id)
    vote_service.cast_vote(
        db, user=candidate_students[0], election_id=open_election.id, candidate_id=cand2.id
    )

    results = election_service.compute_results(db, open_election.id)
    assert results.candidates[0].candidate_id == cand2.id
    assert results.candidates[0].votes == 2


# ─────────────────────────── list_candidates ───────────────────────────


def test_list_candidates_eager_loads_student(db, draft_election):
    candidates = election_service.list_candidates(db, draft_election.id)
    assert len(candidates) > 0
    # student doit être déjà chargé (joinedload)
    for c in candidates:
        assert c.student is not None
