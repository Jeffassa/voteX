"""Planification de la purge : une fois par mois civil, avec rattrapage."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models import AuditAction, AuditEvent, MaintenanceRun
from scripts import purge_scheduler


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "now, last, due",
    [
        (utc(2026, 11, 1, 3, 0), None, True),                      # jamais purgé : tout de suite
        (utc(2026, 11, 20, 12, 0), utc(2026, 11, 1, 3, 0), False),  # déjà fait ce mois-ci
        (utc(2026, 12, 1, 2, 59), utc(2026, 11, 1, 3, 0), False),   # le 1er, on attend 03:00
        (utc(2026, 12, 1, 3, 0), utc(2026, 11, 1, 3, 0), True),     # le 1er à 03:00
        (utc(2026, 12, 9, 8, 0), utc(2026, 10, 1, 3, 0), True),     # mois manqué : rattrapage
        (utc(2027, 1, 1, 4, 0), utc(2026, 12, 1, 3, 0), True),      # changement d'année
    ],
)
def test_when_the_purge_is_due(now, last, due):
    assert purge_scheduler.is_due(now, last) is due


def test_one_purge_per_month_even_after_a_restart(db, monkeypatch):
    calls = []
    real_purge = purge_scheduler.retention_service.purge
    monkeypatch.setattr(
        purge_scheduler.retention_service, "purge", lambda db, now: calls.append(now) or real_purge(db, now=now)
    )
    old = utc(2025, 1, 15)
    db.add(AuditEvent(action=AuditAction.LOGIN, created_at=old))
    db.commit()

    first = utc(2026, 11, 1, 3, 5)
    assert purge_scheduler.run_once(db, now=first) is True
    # Un redémarrage le même mois ne relance rien : l'état vit en base.
    assert purge_scheduler.run_once(db, now=first + timedelta(hours=5)) is False
    assert purge_scheduler.run_once(db, now=utc(2026, 12, 1, 3, 0)) is True

    assert calls == [first, utc(2026, 12, 1, 3, 0)]
    run = db.get(MaintenanceRun, purge_scheduler.TASK)
    assert run.summary and "audit=0" in run.summary  # le 2e passage n'avait plus rien à faire
    assert db.query(AuditEvent).count() == 0
