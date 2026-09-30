"""Le bulletin ne doit être rattachable à son auteur par aucun canal.

Trois fuites ont été trouvées à la relecture du code :
1. `votes.created_at` et `voter_records.created_at` valaient le même `now()`.
2. L'e-mail de reçu et la réponse du vote nommaient le candidat choisi.
3. Les scores en direct étaient lisibles par tout électeur pendant le vote.
"""

import inspect

from app.core.cookies import CSRF_HEADER

from app.models import AuditEvent, Vote
from app.models.election import ElectionStatus
from app.models.student import UserRole
from app.schemas.vote import VoteReceipt, VoteVerification
from app.services import election_service, email_service, vote_service


def test_vote_row_carries_no_timestamp():
    assert "created_at" not in Vote.__table__.columns


def test_audit_trail_does_not_carry_the_ballot_hash(db, voter, open_election):
    vote = vote_service.cast_vote(
        db, user=voter, election_id=open_election.id,
        candidate_id=open_election.candidates[0].id,
    )
    for event in db.query(AuditEvent).all():
        assert vote.vote_hash[2:10] not in (event.details or "")


def test_receipt_and_verification_schemas_hide_the_choice_and_time():
    assert "candidate_id" not in VoteReceipt.model_fields
    assert "created_at" not in VoteVerification.model_fields


def test_receipt_email_has_no_candidate_parameter():
    assert "candidate_name" not in inspect.signature(email_service.send_vote_receipt_email).parameters
    assert "candidate_name" not in inspect.signature(email_service._build_receipt_html).parameters


def test_vote_endpoint_response_does_not_name_the_candidate(auth_client, open_election):
    cand = open_election.candidates[0]
    csrf = auth_client.get("/api/auth/me").headers[CSRF_HEADER]
    r = auth_client.post(
        "/api/votes/",
        json={"election_id": str(open_election.id), "candidate_id": str(cand.id)},
        headers={CSRF_HEADER: csrf},
    )
    assert r.status_code == 201, r.text
    assert "candidate_id" not in r.json()


def test_student_sees_only_turnout_while_election_is_open(db, voter, open_election):
    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id,
        candidate_id=open_election.candidates[0].id,
    )
    res = election_service.results_for_user(db, open_election.id, voter)
    assert res.scores_hidden is True
    assert res.candidates == []
    assert res.total_votes == 1  # la participation reste publique


def test_admin_sees_live_scores(db, voter, open_election):
    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id,
        candidate_id=open_election.candidates[0].id,
    )
    voter.role = UserRole.ADMIN
    db.commit()
    res = election_service.results_for_user(db, open_election.id, voter)
    assert res.scores_hidden is False
    assert sum(c.votes for c in res.candidates) == 1


def test_student_sees_scores_once_closed(db, voter, open_election):
    vote_service.cast_vote(
        db, user=voter, election_id=open_election.id,
        candidate_id=open_election.candidates[0].id,
    )
    open_election.status = ElectionStatus.CLOSED
    db.commit()
    from app.core.cache import cache_delete, key_election_results
    cache_delete(key_election_results(str(open_election.id)))
    res = election_service.results_for_user(db, open_election.id, voter)
    assert res.scores_hidden is False
    assert len(res.candidates) > 0
