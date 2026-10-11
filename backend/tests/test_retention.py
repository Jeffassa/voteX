"""Durées de conservation : la purge fait ce que la page de confidentialité promet."""

from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models import AuditAction, AuditEvent, Candidate, Election, RefreshToken, Student, VoterRecord
from app.models.election import ElectionStatus
from app.schemas.student import StudentUpdate
from app.services import retention_service, student_service

NOW = datetime.now(timezone.utc)
LONG_AGO = NOW - timedelta(days=400)
RECENTLY = NOW - timedelta(days=30)


def _election(db, classroom, *, ends_at, status=ElectionStatus.CLOSED):
    e = Election(
        title="Scrutin", class_id=classroom.id, starts_at=ends_at - timedelta(hours=8),
        ends_at=ends_at, status=status,
    )
    db.add(e)
    db.commit()
    return e


def _student(db, classroom, matricule, *, deactivated_at=None, is_active=None):
    s = Student(
        matricule=matricule, first_name="Awa", last_name="Kouassi",
        email=f"{matricule.lower()}@esatic.edu.ci", password_hash=hash_password("motdepasse1"),
        class_id=classroom.id,
        is_active=deactivated_at is None if is_active is None else is_active,
        deactivated_at=deactivated_at,
    )
    db.add(s)
    db.commit()
    return s


def _voted(db, student, election):
    db.add(VoterRecord(election_id=election.id, student_id=student.id))
    db.commit()


def test_participation_is_kept_12_months_after_the_close(db, classroom, voter):
    old = _election(db, classroom, ends_at=LONG_AGO)
    recent = _election(db, classroom, ends_at=RECENTLY)
    running = _election(db, classroom, ends_at=LONG_AGO, status=ElectionStatus.OPEN)
    for e in (old, recent, running):
        _voted(db, voter, e)

    report = retention_service.purge(db, now=NOW)

    assert report.voter_records == 1
    remaining = {r.election_id for r in db.query(VoterRecord).all()}
    assert remaining == {recent.id, running.id}


def test_audit_log_is_kept_12_months(db):
    db.add_all([
        AuditEvent(action=AuditAction.LOGIN, ip_address="10.0.0.1", created_at=LONG_AGO),
        AuditEvent(action=AuditAction.LOGIN, ip_address="10.0.0.2", created_at=RECENTLY),
    ])
    db.commit()

    assert retention_service.purge(db, now=NOW).audit_events == 1
    assert [e.ip_address for e in db.query(AuditEvent).all()] == ["10.0.0.2"]


def test_expired_sessions_are_deleted(db, voter):
    db.add_all([
        RefreshToken(user_id=voter.id, jti="a", token_hash="ha", expires_at=NOW - timedelta(days=1)),
        RefreshToken(user_id=voter.id, jti="b", token_hash="hb", expires_at=NOW + timedelta(days=1)),
    ])
    db.commit()

    assert retention_service.purge(db, now=NOW).refresh_tokens == 1
    assert [t.jti for t in db.query(RefreshToken).all()] == ["b"]


def test_withdrawn_account_is_deleted_12_months_later(db, classroom, voter):
    gone = _student(db, classroom, "24-ESATIC0001AA", deactivated_at=LONG_AGO)
    just_left = _student(db, classroom, "24-ESATIC0002AA", deactivated_at=RECENTLY)
    # Revendication en salle d'attente : inactive, mais jamais retirée.
    waiting = _student(db, classroom, "24-ESATIC0003AA", is_active=False)

    report = retention_service.purge(db, now=NOW)

    assert report.students_deleted == 1
    left = {s.matricule for s in db.query(Student).all()}
    assert gone.matricule not in left
    assert {just_left.matricule, waiting.matricule, voter.matricule} <= left


def test_former_candidate_is_anonymized_and_stays_in_the_results(db, classroom):
    election = _election(db, classroom, ends_at=LONG_AGO)
    candidate = _student(db, classroom, "24-ESATIC0004AA", deactivated_at=LONG_AGO)
    candidate.photo_url = "https://exemple.ci/photo.jpg"
    db.add(Candidate(election_id=election.id, student_id=candidate.id, program="Programme"))
    db.commit()

    report = retention_service.purge(db, now=NOW)

    assert report.students_anonymized == 1 and report.students_deleted == 0
    db.refresh(candidate)
    assert candidate.matricule.startswith(retention_service.ANONYMIZED_PREFIX)
    assert candidate.email is None and candidate.password_hash is None and candidate.photo_url is None
    assert (candidate.first_name, candidate.last_name) == ("Awa", "Kouassi")
    assert db.query(Candidate).filter(Candidate.student_id == candidate.id).count() == 1
    # Déjà anonymisé : la purge suivante ne le retraite pas.
    assert retention_service.purge(db, now=NOW).students_anonymized == 0


def test_account_waits_while_its_participation_is_still_kept(db, classroom):
    recent = _election(db, classroom, ends_at=RECENTLY)
    student = _student(db, classroom, "24-ESATIC0005AA", deactivated_at=LONG_AGO)
    _voted(db, student, recent)

    report = retention_service.purge(db, now=NOW)

    assert report.students_postponed == 1 and report.students_deleted == 0
    assert db.get(Student, student.id) is not None


def test_dry_run_counts_without_deleting(db, classroom, voter):
    old = _election(db, classroom, ends_at=LONG_AGO)
    gone = _student(db, classroom, "24-ESATIC0006AA", deactivated_at=LONG_AGO)
    _voted(db, gone, old)
    db.add(AuditEvent(action=AuditAction.LOGIN, created_at=LONG_AGO))
    db.commit()

    report = retention_service.purge(db, now=NOW, dry_run=True)

    # Le compte est annoncé supprimable : sa seule participation part dans la même purge.
    assert (report.voter_records, report.audit_events, report.students_deleted) == (1, 1, 1)
    assert db.query(VoterRecord).count() == 1
    assert db.query(AuditEvent).count() == 1
    assert db.get(Student, gone.id) is not None

    real = retention_service.purge(db, now=NOW)
    assert real == report
    assert db.get(Student, gone.id) is None


def test_withdrawing_an_account_starts_the_clock(db, classroom, voter, other_class_voter):
    _voted(db, voter, _election(db, classroom, ends_at=RECENTLY))

    # Un électeur qui a voté n'est pas effacé mais retiré : le délai part de là.
    student_service.delete(db, voter.id, current_user_id=other_class_voter.id)
    db.refresh(voter)
    assert voter.is_active is False and voter.deactivated_at is not None

    # Rendu à la vie : le délai s'annule.
    student_service.update(db, voter.id, StudentUpdate(is_active=True))
    db.refresh(voter)
    assert voter.deactivated_at is None

    student_service.update(db, voter.id, StudentUpdate(is_active=False))
    db.refresh(voter)
    assert voter.deactivated_at is not None
