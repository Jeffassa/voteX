"""Un scrutin entamé ne se réécrit pas : candidats figés, statut qui ne recule pas."""

import pytest

from app.core.exceptions import ConflictError
from app.models import Candidate, Vote
from app.models.election import ElectionStatus
from app.schemas.candidate import CandidateCreate
from app.services import ballot_box, candidate_service, election_service, vote_service


def test_removing_a_candidate_during_the_vote_is_refused(db, open_election, voter):
    """L'attaque de l'audit : ses voix devenaient des votes blancs."""
    cand = open_election.candidates[0]
    vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand.id)

    with pytest.raises(ConflictError):
        candidate_service.delete(db, cand.id)

    assert db.get(Candidate, cand.id) is not None
    ballot_box.mix(db, open_election.id, final=True)
    assert [v.candidate_id for v in db.query(Vote).all()] == [cand.id]


def test_a_candidate_with_votes_is_never_removed(db, open_election, voter):
    """Filet : même si le statut était forcé en base, des voix bloquent la suppression."""
    cand = open_election.candidates[0]
    vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand.id)
    ballot_box.mix(db, open_election.id, final=True)
    open_election.status = ElectionStatus.DRAFT
    db.commit()

    with pytest.raises(ConflictError, match="voix"):
        candidate_service.delete(db, cand.id)
    assert [v.candidate_id for v in db.query(Vote).all()] == [cand.id]


def test_candidates_cannot_be_added_once_the_vote_is_open(db, open_election, voter):
    with pytest.raises(ConflictError):
        candidate_service.create(
            db, CandidateCreate(election_id=open_election.id, student_id=voter.id)
        )


def test_candidates_are_managed_freely_while_in_draft(db, draft_election):
    cand = draft_election.candidates[0]
    candidate_service.delete(db, cand.id)
    assert db.get(Candidate, cand.id) is None


@pytest.mark.parametrize(
    "start, target",
    [
        (ElectionStatus.CLOSED, ElectionStatus.OPEN),
        (ElectionStatus.OPEN, ElectionStatus.DRAFT),
        (ElectionStatus.PUBLISHED, ElectionStatus.OPEN),
        (ElectionStatus.DRAFT, ElectionStatus.CLOSED),
    ],
)
def test_the_status_never_goes_backwards(db, open_election, start, target):
    open_election.status = start
    db.commit()
    with pytest.raises(ConflictError):
        election_service.set_status(db, open_election.id, target)
    db.refresh(open_election)
    assert open_election.status == start


def test_normal_life_cycle_still_works(db, draft_election):
    for status in (ElectionStatus.OPEN, ElectionStatus.CLOSED, ElectionStatus.PUBLISHED):
        assert election_service.set_status(db, draft_election.id, status).status == status
