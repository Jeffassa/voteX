"""Tâches planifiées des scrutins : clôture à l'heure de fin, relance des non-votants.

Exécutées chaque minute par scripts/election_scheduler.py (service `scheduler`
du docker-compose). Chaque tâche se rejoue sans effet de bord : un scrutin clos
ne se reclôt pas, une relance est datée avant l'envoi et ne repart pas.

Pas d'ouverture automatique : un brouillon n'est pas validé (candidats, dates).
L'administrateur l'ouvre ; s'il le fait en avance, le vote n'est accepté qu'à
l'heure de début, ce qui revient à le programmer.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Election, Student
from app.models.audit import AuditAction
from app.models.election import ElectionStatus
from app.services import audit_service, election_service, email_service

logger = logging.getLogger(__name__)

# Plus près de la fin, la relance arriverait après la clôture.
REMINDER_MIN_REMAINING = timedelta(minutes=15)
# Envois simultanés vers le serveur SMTP : une classe entière d'un coup
# ouvrirait autant de connexions.
SMTP_CONCURRENCY = 5


@dataclass(frozen=True)
class SchedulerReport:
    closed: int
    reminded: int


def _aware(dt: datetime) -> datetime:
    """SQLite rend des dates naïves : elles sont en UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def close_expired(db: Session, now: datetime) -> int:
    """Clôt les scrutins ouverts dont l'heure de fin est passée."""
    # SKIP LOCKED : une seconde instance du service passe son chemin au lieu
    # d'attendre (sans effet sous SQLite, qui l'ignore).
    expired = [
        e.id for e in db.query(Election)
        .filter(Election.status == ElectionStatus.OPEN, Election.ends_at <= now)
        .with_for_update(skip_locked=True)
        .all()
    ]
    closed = 0
    for election_id in expired:
        try:
            # Même chemin que le bouton « Clôturer » : urne vidée, ancrage,
            # cache invalidé, journal. Un scrutin déjà clos est laissé tel quel.
            election_service.set_status(
                db, election_id, ElectionStatus.CLOSED, actor_id=None,
                reason="clôture automatique à l'heure de fin",
            )
            closed += 1
            logger.info("scrutin %s clos à son heure de fin", election_id)
        except Exception:
            db.rollback()
            logger.exception("clôture automatique du scrutin %s en échec", election_id)
    return closed


def reminder_due(election: Election, now: datetime) -> bool:
    """La relance part au plus tard VOTE_REMINDER_HOURS avant la fin, jamais
    avant la moitié du scrutin (un vote de deux heures n'est pas relancé dès
    l'ouverture), et plus du tout dans le dernier quart d'heure."""
    if settings.VOTE_REMINDER_HOURS <= 0 or election.reminder_sent_at is not None:
        return False
    starts, ends = _aware(election.starts_at), _aware(election.ends_at)
    if now < starts or now >= ends:
        return False
    remaining = ends - now
    window = min(timedelta(hours=settings.VOTE_REMINDER_HOURS), (ends - starts) / 2)
    return REMINDER_MIN_REMAINING <= remaining <= window


async def _send_all(election: Election, recipients: list[Student]) -> None:
    gate = asyncio.Semaphore(SMTP_CONCURRENCY)
    ends_at = _aware(election.ends_at)

    async def one(student: Student) -> None:
        async with gate:
            await email_service.send_vote_reminder_email(
                to_email=student.email,
                voter_name=f"{student.first_name} {student.last_name}",
                election_title=election.title,
                election_id=str(election.id),
                ends_at=ends_at,
            )

    await asyncio.gather(*(one(s) for s in recipients))


def send_reminders(db: Session, now: datetime) -> int:
    """Relance par e-mail les inscrits qui n'ont pas voté. Renvoie le nombre d'e-mails."""
    if settings.VOTE_REMINDER_HOURS <= 0:
        return 0
    if not email_service.is_configured():
        # Sans SMTP, rien ne partirait : on ne date pas la relance, elle
        # partira si l'envoi est configuré avant la fin du scrutin.
        return 0
    open_ids = [
        e.id for e in db.query(Election)
        .filter(Election.status == ElectionStatus.OPEN, Election.reminder_sent_at.is_(None))
        .all()
        if reminder_due(e, now)
    ]
    sent = 0
    for election_id in open_ids:
        election = (
            db.query(Election)
            .filter(Election.id == election_id, Election.reminder_sent_at.is_(None))
            .with_for_update(skip_locked=True)
            .first()
        )
        if election is None:
            continue
        # Datée AVANT l'envoi : une panne au milieu des e-mails ne doit pas
        # relancer deux fois ceux qui ont déjà reçu le leur.
        election.reminder_sent_at = now
        db.commit()
        recipients = [s for s in election_service.list_non_voters(db, election_id) if s.email]
        asyncio.run(_send_all(election, recipients))
        audit_service.record(
            db,
            action=AuditAction.ELECTION_REMINDER_SENT,
            actor_id=None,
            target_type="election",
            target_id=election_id,
            details=f"{len(recipients)} non-votant{'s' if len(recipients) > 1 else ''} relancé{'s' if len(recipients) > 1 else ''}",
        )
        logger.info("scrutin %s : %d relance(s) envoyée(s)", election_id, len(recipients))
        sent += len(recipients)
    return sent


def run_once(db: Session, now: datetime | None = None) -> SchedulerReport:
    now = now or datetime.now(timezone.utc)
    return SchedulerReport(closed=close_expired(db, now), reminded=send_reminders(db, now))
