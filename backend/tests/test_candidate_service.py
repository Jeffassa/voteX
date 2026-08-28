"""Tests de candidate_service.

Invariants :
- candidat doit appartenir à la classe de l'élection
- pas de doublon (un étudiant ne peut être candidat qu'une fois par élection)
- création OK avec slogan/programme/bio optionnels
- suppression OK
"""

from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Candidate
from app.schemas.candidate import CandidateCreate
from app.services import candidate_service


def test_create_candidate_happy_path(db, draft_election, candidate_students):
    # Le seed met déjà des candidats — on en delete un puis on le recrée
    existing_first = draft_election.candidates[0]
    student_id = existing_first.student_id
    db.delete(existing_first)
    db.commit()

    payload = CandidateCreate(
        election_id=draft_election.id,
        student_id=student_id,
        slogan="Mon slogan",
        program="Programme\nLigne 2",
        biography="Ma bio",
    )
    candidate = candidate_service.create(db, payload)

    assert candidate.id is not None
    assert candidate.election_id == draft_election.id
    assert candidate.student_id == student_id
    assert candidate.slogan == "Mon slogan"
    assert candidate.program == "Programme\nLigne 2"


def test_create_candidate_rejects_unknown_election(db, candidate_students):
    payload = CandidateCreate(
        election_id=uuid4(),
        student_id=candidate_students[0].id,
    )
    with pytest.raises(NotFoundError, match="Élection"):
        candidate_service.create(db, payload)


def test_create_candidate_rejects_unknown_student(db, draft_election):
    payload = CandidateCreate(
        election_id=draft_election.id,
        student_id=uuid4(),
    )
    with pytest.raises(NotFoundError, match="Étudiant"):
        candidate_service.create(db, payload)


def test_create_candidate_rejects_student_from_other_class(db, draft_election, other_class_voter):
    payload = CandidateCreate(
        election_id=draft_election.id,
        student_id=other_class_voter.id,
    )
    with pytest.raises(ValidationError, match="n'appartient pas"):
        candidate_service.create(db, payload)


def test_create_candidate_rejects_duplicate(db, draft_election):
    """Un étudiant déjà candidat à cette élection ne peut être ajouté à nouveau."""
    existing = draft_election.candidates[0]
    payload = CandidateCreate(
        election_id=draft_election.id,
        student_id=existing.student_id,
    )
    with pytest.raises(ConflictError, match="déjà candidat"):
        candidate_service.create(db, payload)


def test_get_or_404_returns_with_student_eager_loaded(db, draft_election):
    existing = draft_election.candidates[0]
    candidate = candidate_service.get_or_404(db, existing.id)
    # L'étudiant doit être chargé sans round-trip supplémentaire
    assert candidate.student is not None
    assert candidate.student.id == existing.student_id


def test_get_or_404_raises_for_unknown_id(db):
    with pytest.raises(NotFoundError, match="Candidat"):
        candidate_service.get_or_404(db, uuid4())


def test_delete_removes_candidate(db, draft_election):
    existing = draft_election.candidates[0]
    candidate_id = existing.id
    candidate_service.delete(db, candidate_id)

    assert db.query(Candidate).filter(Candidate.id == candidate_id).first() is None


def test_delete_unknown_candidate_raises(db):
    with pytest.raises(NotFoundError):
        candidate_service.delete(db, uuid4())
