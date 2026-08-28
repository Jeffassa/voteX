"""Tests de la logique critique du vote.

Couverture des invariants de sécurité :
- un étudiant ne peut voter qu'une fois par élection
- un étudiant ne peut voter que pour sa classe
- un vote est rejeté si l'élection n'est pas OPEN
- un vote est rejeté si on est hors de la période start/end
- le candidat doit appartenir à l'élection
- le hash de vote est unique et déterministe pour un même nonce
"""

from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models import Candidate, Vote, VoterRecord
from app.services import vote_service


# ─────────────────────────── happy path ───────────────────────────


def test_cast_vote_succeeds_in_open_election(db, voter, open_election):
    cand = open_election.candidates[0]

    vote = vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand.id
    )

    assert vote.id is not None
    assert vote.candidate_id == cand.id
    assert vote.election_id == open_election.id
    assert vote.vote_hash.startswith("0x")
    assert len(vote.vote_hash) == 66  # 0x + 64 hex chars
    # Sans blockchain configurée → tx_hash et block_number doivent être None
    assert vote.tx_hash is None
    assert vote.block_number is None

    # On vérifie que la participation a bien été enregistrée
    has_record = db.query(VoterRecord).filter(
        VoterRecord.student_id == voter.id, VoterRecord.election_id == open_election.id
    ).count() == 1
    assert has_record


def test_cast_vote_persists_and_appears_in_db(db, voter, open_election):
    cand = open_election.candidates[0]
    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand.id
    )
    count = db.query(Vote).filter(Vote.election_id == open_election.id).count()
    assert count == 1


# ─────────────────────────── invariants ───────────────────────────


def test_cannot_vote_twice_in_same_election(db, voter, open_election):
    cand1, cand2 = open_election.candidates[0], open_election.candidates[1]

    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand1.id
    )

    with pytest.raises(ConflictError, match="déjà voté"):
        vote_service.cast_vote(
            db, user=voter, election_id=open_election.id, candidate_id=cand2.id
        )

    # Et une seule participation enregistrée
    assert db.query(VoterRecord).filter(VoterRecord.student_id == voter.id).count() == 1


def test_cannot_vote_in_draft_election(db, voter, draft_election):
    cand = draft_election.candidates[0]
    with pytest.raises(ValidationError, match="pas ouverte"):
        vote_service.cast_vote(
            db, user=voter, election_id=draft_election.id, candidate_id=cand.id
        )


def test_cannot_vote_outside_period(db, voter, expired_election):
    cand = expired_election.candidates[0]
    with pytest.raises(ValidationError, match="période active"):
        vote_service.cast_vote(
            db, user=voter, election_id=expired_election.id, candidate_id=cand.id
        )


def test_cannot_vote_for_another_class_election(db, other_class_voter, open_election):
    cand = open_election.candidates[0]
    with pytest.raises(ForbiddenError, match="autorisé"):
        vote_service.cast_vote(
            db,
            user=other_class_voter,
            election_id=open_election.id,
            candidate_id=cand.id,
        )


def test_cannot_vote_for_unrelated_candidate(db, voter, open_election, draft_election):
    """Le candidat doit appartenir à l'élection visée."""
    foreign_candidate = draft_election.candidates[0]
    with pytest.raises(ValidationError, match="Candidat invalide"):
        vote_service.cast_vote(
            db,
            user=voter,
            election_id=open_election.id,
            candidate_id=foreign_candidate.id,
        )


def test_cannot_vote_election_not_found(db, voter, open_election):
    cand = open_election.candidates[0]
    with pytest.raises(NotFoundError, match="introuvable"):
        vote_service.cast_vote(
            db, user=voter, election_id=uuid4(), candidate_id=cand.id
        )


def test_voter_with_no_class_is_forbidden(db, voter, open_election):
    voter.class_id = None
    db.commit()
    cand = open_election.candidates[0]
    with pytest.raises(ForbiddenError):
        vote_service.cast_vote(
            db, user=voter, election_id=open_election.id, candidate_id=cand.id
        )


# ─────────────────────────── helpers ───────────────────────────


def test_has_voted_returns_false_then_true(db, voter, open_election):
    cand = open_election.candidates[0]
    assert vote_service.has_voted(db, user=voter, election_id=open_election.id) is False

    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand.id
    )
    assert vote_service.has_voted(db, user=voter, election_id=open_election.id) is True


def test_list_for_user_returns_only_owned_votes(db, voter, open_election, candidate_students):
    """Un étudiant ne voit que SES participations de manière anonymisée."""
    other_voter = candidate_students[0]
    cand = open_election.candidates[1]

    # voter vote
    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand.id
    )
    # other_voter (qui est un candidate_student de la même classe) vote pour quelqu'un d'autre
    vote_service.cast_vote(
        db,
        user=other_voter,
        election_id=open_election.id,
        candidate_id=open_election.candidates[2].id,
    )

    mine = vote_service.list_for_user(db, voter)
    assert len(mine) == 1
    assert mine[0]["election_id"] == open_election.id
    assert mine[0]["vote_hash"] == "anonymisé"


# ─────────────────────────── verify ───────────────────────────


def test_verify_unknown_hash_returns_invalid(db):
    result = vote_service.verify_vote_by_hash(db, vote_hash="0xdeadbeef")
    assert result.valid is False
    assert "Aucun vote" in result.message


def test_verify_known_hash_returns_authentic(db, voter, open_election):
    cand = open_election.candidates[0]
    vote = vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand.id
    )

    result = vote_service.verify_vote_by_hash(db, vote_hash=vote.vote_hash)
    assert result.valid is True
    assert result.election_title == open_election.title
    # L'identité du votant ne doit JAMAIS apparaître dans la vérification
    assert "Bamba" not in result.message
    assert "Sékou" not in result.message


# ─────────────────────────── propriétés du hash ───────────────────────────


def test_vote_hash_is_unique_across_votes(db, voter, candidate_students, open_election):
    """Deux votes différents produisent deux hashes différents (le nonce est aléatoire)."""
    cand1 = open_election.candidates[0]
    cand2 = open_election.candidates[1]

    v1 = vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=cand1.id
    )

    # Voter avec un autre étudiant pour avoir un 2e vote dans la même élection
    other_voter = candidate_students[0]
    v2 = vote_service.cast_vote(
        db, user=other_voter, election_id=open_election.id, candidate_id=cand2.id
    )

    assert v1.vote_hash != v2.vote_hash


def test_vote_hash_is_deterministic_for_same_inputs(monkeypatch):
    """Pour un nonce fixé, le hash doit être reproductible. Garantit la
    vérifiabilité côté client si un étudiant veut prouver son vote."""
    from app.services import blockchain

    h1 = blockchain.compute_vote_hash("student-1", "election-1", "cand-1", "nonce-A")
    h2 = blockchain.compute_vote_hash("student-1", "election-1", "cand-1", "nonce-A")
    h3 = blockchain.compute_vote_hash("student-1", "election-1", "cand-1", "nonce-B")

    assert h1 == h2
    assert h1 != h3
    assert h1.startswith("0x")
    assert len(h1) == 66
