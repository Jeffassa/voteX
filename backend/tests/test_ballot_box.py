"""Urne chiffrée et brassage : aucun lien entre un bulletin et son auteur, même en base.

PostgreSQL marque chaque ligne de l'identifiant de la transaction qui l'a
écrite (`xmin`). Un bulletin écrit en clair dans la même transaction que la
participation de son auteur lui restait donc relié. SQLite n'a pas de `xmin` :
on vérifie la cause elle-même, qu'aucune transaction n'écrive les deux.
"""

from sqlalchemy import event

from app.core.security import hash_password
from app.models import SealedBallot, Student, Vote, VoterRecord
from app.models.election import ElectionStatus
from app.models.student import UserRole
from app.services import ballot_box, election_service, vote_service


def _voters(db, classroom, n):
    students = [
        Student(
            matricule=f"24-ESATIC{i:04d}ZZ", first_name=f"Électeur{i}", last_name="Test",
            password_hash=hash_password("x" * 12), role=UserRole.STUDENT,
            class_id=classroom.id, is_active=True,
        )
        for i in range(n)
    ]
    db.add_all(students)
    db.commit()
    return students


def _vote_all(db, election, voters):
    cands = election.candidates
    return [
        vote_service.cast_vote(db, user=v, election_id=election.id, candidate_id=cands[i % len(cands)].id)
        for i, v in enumerate(voters)
    ]


def test_no_transaction_writes_both_a_participation_and_a_vote(db, classroom, open_election):
    written: list[set[str]] = [set()]

    @event.listens_for(db, "after_flush")
    def _track(session, _ctx):
        written[-1].update(type(o).__name__ for o in session.new)

    @event.listens_for(db, "after_commit")
    def _next(_session):
        written.append(set())

    _vote_all(db, open_election, _voters(db, classroom, 12))
    ballot_box.mix(db, open_election.id)
    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)

    assert db.query(Vote).count() == 12
    for tables in written:
        assert not {"VoterRecord", "Vote"} <= tables, tables


def test_the_urn_reveals_neither_the_choice_nor_the_receipt(db, voter, open_election):
    cand = open_election.candidates[0]
    receipt = vote_service.cast_vote(db, user=voter, election_id=open_election.id, candidate_id=cand.id)

    sealed = db.query(SealedBallot).one().sealed
    assert str(cand.id) not in sealed and receipt.vote_hash not in sealed
    assert ballot_box.unseal(sealed) == (cand.id, receipt.vote_hash)
    # Deux bulletins identiques ne se ressemblent pas une fois chiffrés.
    assert ballot_box.seal(cand.id, "0x00") != ballot_box.seal(cand.id, "0x00")


def test_the_urn_keeps_a_pool_while_open_and_empties_at_close(db, classroom, open_election):
    voters = _voters(db, classroom, 10)
    _vote_all(db, open_election, voters[:9])
    assert ballot_box.mix(db, open_election.id) == 0, "moins de 10 bulletins : on attend"

    _vote_all(db, open_election, voters[9:])
    assert ballot_box.mix(db, open_election.id) == 10 - ballot_box.POOL_SIZE
    assert ballot_box.pending_count(db, open_election.id) == ballot_box.POOL_SIZE
    assert ballot_box.cast_count(db, open_election.id) == 10

    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)
    assert ballot_box.pending_count(db, open_election.id) == 0
    assert db.query(Vote).filter(Vote.election_id == open_election.id).count() == 10
    assert db.query(VoterRecord).filter(VoterRecord.election_id == open_election.id).count() == 10


def test_published_results_count_a_ballot_left_in_the_urn(db, voter, open_election):
    """Un bulletin arrivé pendant la clôture est versé avant la publication."""
    cand = open_election.candidates[0]
    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)
    ballot_box.deposit(db, election_id=open_election.id, candidate_id=cand.id, vote_hash="0x" + "cd" * 32)
    db.commit()

    res = election_service.results_for_user(db, open_election.id, voter)
    assert res.total_votes == 1 and sum(c.votes for c in res.candidates) == 1


def test_a_receipt_is_verifiable_while_its_ballot_waits_in_the_urn(db, voter, open_election):
    receipt = vote_service.cast_vote(
        db, user=voter, election_id=open_election.id, candidate_id=open_election.candidates[0].id
    )
    check = vote_service.verify_vote_by_hash(db, vote_hash=receipt.vote_hash)
    assert check.valid is True and check.anchored is False
    assert check.election_title == open_election.title
