"""Tâche planifiée des scrutins : clôture à l'heure de fin, relance des non-votants."""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.models import AuditEvent, Election, VoterRecord
from app.models.audit import AuditAction
from app.models.election import ElectionStatus
from app.services import election_scheduler, email_service


@pytest.fixture()
def sent(monkeypatch):
    """Capture les relances au lieu de les envoyer, SMTP réputé configuré."""
    outbox: list[dict] = []

    async def fake_send(**kwargs):
        outbox.append(kwargs)

    monkeypatch.setattr(email_service, "send_vote_reminder_email", fake_send)
    monkeypatch.setattr(email_service, "is_configured", lambda: True)
    monkeypatch.setattr(settings, "VOTE_REMINDER_HOURS", 24)
    return outbox


def _election(db, classroom, *, starts, ends, status=ElectionStatus.OPEN) -> Election:
    e = Election(title="Chef de classe", class_id=classroom.id, starts_at=starts, ends_at=ends, status=status)
    db.add(e)
    db.commit()
    return e


# ── Clôture ───────────────────────────────────────────────────────────────

def test_open_election_is_closed_at_its_end(db, classroom):
    now = datetime.now(timezone.utc)
    ended = _election(db, classroom, starts=now - timedelta(days=1), ends=now - timedelta(minutes=1))
    running = _election(db, classroom, starts=now - timedelta(hours=1), ends=now + timedelta(hours=1))
    draft = _election(db, classroom, starts=now - timedelta(days=1), ends=now - timedelta(minutes=1),
                      status=ElectionStatus.DRAFT)

    report = election_scheduler.run_once(db, now)

    assert report.closed == 1
    db.expire_all()
    assert db.get(Election, ended.id).status == ElectionStatus.CLOSED
    assert db.get(Election, running.id).status == ElectionStatus.OPEN
    # Un brouillon n'est jamais touché : il n'a pas été validé.
    assert db.get(Election, draft.id).status == ElectionStatus.DRAFT

    entry = db.query(AuditEvent).filter(AuditEvent.action == AuditAction.ELECTION_CLOSED).one()
    assert entry.actor_id is None
    assert "clôture automatique" in entry.details

    # Rejouée, la tâche ne refait rien.
    assert election_scheduler.run_once(db, now).closed == 0


# ── Relance ───────────────────────────────────────────────────────────────

def test_reminder_goes_to_non_voters_once(db, classroom, voter, candidate_students, sent):
    now = datetime.now(timezone.utc)
    e = _election(db, classroom, starts=now - timedelta(days=2), ends=now + timedelta(hours=10))
    db.add(VoterRecord(election_id=e.id, student_id=voter.id))
    db.commit()

    report = election_scheduler.run_once(db, now)

    recipients = {m["to_email"] for m in sent}
    assert voter.email not in recipients
    assert recipients == {s.email for s in candidate_students}
    assert report.reminded == len(candidate_students)
    assert all(m["election_id"] == str(e.id) for m in sent)

    db.expire_all()
    assert db.get(Election, e.id).reminder_sent_at is not None
    entry = db.query(AuditEvent).filter(AuditEvent.action == AuditAction.ELECTION_REMINDER_SENT).one()
    assert entry.details == "3 non-votants relancés"

    sent.clear()
    assert election_scheduler.run_once(db, now + timedelta(hours=1)).reminded == 0
    assert sent == []


@pytest.mark.parametrize(
    ("starts", "ends", "due"),
    [
        (timedelta(days=-2), timedelta(hours=30), False),   # plus de 24 h avant la fin
        (timedelta(days=-2), timedelta(hours=23), True),
        (timedelta(hours=-1), timedelta(hours=1, minutes=30), False),  # avant la moitié
        (timedelta(hours=-1, minutes=-30), timedelta(hours=1), True),
        (timedelta(days=-1), timedelta(minutes=10), False),  # dernier quart d'heure
        (timedelta(hours=1), timedelta(hours=5), False),     # pas encore commencé
    ],
)
def test_reminder_window(db, classroom, starts, ends, due, sent):
    now = datetime.now(timezone.utc)
    e = _election(db, classroom, starts=now + starts, ends=now + ends)
    assert election_scheduler.reminder_due(e, now) is due


def test_no_reminder_without_smtp(db, classroom, candidate_students, sent, monkeypatch):
    monkeypatch.setattr(email_service, "is_configured", lambda: False)
    now = datetime.now(timezone.utc)
    e = _election(db, classroom, starts=now - timedelta(days=2), ends=now + timedelta(hours=10))

    assert election_scheduler.run_once(db, now).reminded == 0
    db.expire_all()
    # Pas datée : elle partira si l'envoi est configuré avant la fin.
    assert db.get(Election, e.id).reminder_sent_at is None


def test_reminders_can_be_turned_off(db, classroom, candidate_students, sent, monkeypatch):
    monkeypatch.setattr(settings, "VOTE_REMINDER_HOURS", 0)
    now = datetime.now(timezone.utc)
    _election(db, classroom, starts=now - timedelta(days=2), ends=now + timedelta(hours=10))
    assert election_scheduler.run_once(db, now).reminded == 0
    assert sent == []
