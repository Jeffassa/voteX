"""Reçu redonné quand la réponse d'un vote s'est perdue.

Le navigateur tire un jeton (receipt_key) avant l'envoi et le renvoie s'il
réessaie. La même requête redonne le même reçu ; toute autre reçoit « déjà
voté ». Rien n'est stocké qui relierait l'électeur à son bulletin.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.cookies import CSRF_HEADER
from app.models import AuditEvent, Election, VoterRecord
from app.models.audit import AuditAction
from app.models.election import ElectionStatus
from app.services import ballot_box, email_service, vote_service

KEY = "k3Y-aleatoire_du_navigateur_0123"


def _login(client, matricule: str, password: str) -> dict:
    r = client.post("/api/auth/login", data={"username": matricule, "password": password})
    assert r.status_code == 200, r.text
    return {CSRF_HEADER: r.headers[CSRF_HEADER]}


@pytest.fixture()
def receipts_sent(monkeypatch):
    calls: list[dict] = []

    async def fake(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(email_service, "send_vote_receipt_email", fake)
    return calls


def _vote(client, headers, election, candidate_id, key=KEY):
    body = {"election_id": str(election.id), "candidate_id": candidate_id}
    if key is not None:
        body["receipt_key"] = key
    return client.post("/api/votes/", json=body, headers=headers)


def _ballots(db, election) -> int:
    """Bulletins brassés plus bulletins encore dans l'urne."""
    return ballot_box.cast_count(db, election.id)


def test_same_request_gives_back_the_same_receipt(client, db, voter, open_election, receipts_sent):
    h = _login(client, voter.matricule, "student12345")
    cid = str(open_election.candidates[0].id)

    first = _vote(client, h, open_election, cid)
    again = _vote(client, h, open_election, cid)

    assert first.status_code == 201 and again.status_code == 201, again.text
    assert again.json()["vote_hash"] == first.json()["vote_hash"]
    # Un seul bulletin, une seule participation, un seul reçu par e-mail.
    assert _ballots(db, open_election) == 1
    assert db.query(VoterRecord).filter(VoterRecord.election_id == open_election.id).count() == 1
    assert db.query(AuditEvent).filter(AuditEvent.action == AuditAction.VOTE_CAST).count() == 1
    assert len(receipts_sent) == 1
    # Le reçu redonné se vérifie comme l'original.
    assert client.get(f"/api/votes/verify/{first.json()['vote_hash']}").json()["valid"] is True


def test_another_choice_or_no_key_is_already_voted(client, voter, open_election, receipts_sent):
    h = _login(client, voter.matricule, "student12345")
    c0, c1 = (str(c.id) for c in open_election.candidates[:2])
    assert _vote(client, h, open_election, c0).status_code == 201

    # Même jeton, autre candidat : ce n'est pas la même requête.
    assert _vote(client, h, open_election, c1).status_code == 409
    # Pas de jeton : comportement d'avant.
    assert _vote(client, h, open_election, c0, key=None).status_code == 409
    # Vote blanc avec le même jeton : autre requête aussi.
    assert _vote(client, h, open_election, None).status_code == 409


def test_replay_window_is_short(client, db, voter, open_election, receipts_sent):
    h = _login(client, voter.matricule, "student12345")
    cid = str(open_election.candidates[0].id)
    assert _vote(client, h, open_election, cid).status_code == 201

    record = db.query(VoterRecord).filter(VoterRecord.election_id == open_election.id).one()
    record.created_at = datetime.now(timezone.utc) - vote_service.RECEIPT_REPLAY_WINDOW - timedelta(seconds=1)
    db.commit()

    assert _vote(client, h, open_election, cid).status_code == 409


def test_replay_after_closing_still_gives_the_receipt(client, db, voter, open_election, receipts_sent):
    """Vote à la dernière seconde, réponse perdue, scrutin clos au nouvel essai."""
    h = _login(client, voter.matricule, "student12345")
    cid = str(open_election.candidates[0].id)
    first = _vote(client, h, open_election, cid)
    assert first.status_code == 201

    from app.services import election_service
    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)
    assert db.get(Election, open_election.id).status == ElectionStatus.CLOSED

    again = _vote(client, h, open_election, cid)
    assert again.status_code == 201, again.text
    assert again.json()["vote_hash"] == first.json()["vote_hash"]


def test_receipt_key_is_validated(client, voter, open_election):
    h = _login(client, voter.matricule, "student12345")
    cid = str(open_election.candidates[0].id)
    assert _vote(client, h, open_election, cid, key="court").status_code == 422
    assert _vote(client, h, open_election, cid, key="x" * 30 + "<script>").status_code == 422
