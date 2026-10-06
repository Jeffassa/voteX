"""Durées de conservation annoncées par la politique de confidentialité.

La page /confidentialite (frontend/src/pages/legal/PrivacyPage.tsx) promet :

- compte électeur : supprimé 12 mois après son retrait par l'administration
  (fin de scolarité) ; celui d'un ancien candidat est anonymisé, son nom et son
  programme restant attachés aux résultats publiés ;
- participation (le fait d'avoir voté) : 12 mois après la clôture du scrutin ;
- journal d'audit : 12 mois ;
- sessions expirées : supprimées.

Les bulletins restent : ils ne portent aucune donnée personnelle (ni électeur,
ni heure) et fondent les résultats publiés.

Ce module n'est appelé que par scripts/purge_retention.py, avec le rôle de
migration : le rôle applicatif n'a pas le droit de supprimer dans
`voter_records` ni dans `audit_events` (scripts/setup_db_role.sql), et c'est
voulu. Une purge lancée depuis l'application échouerait en production.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, Candidate, Election, RefreshToken, Student, VoterRecord
from app.models.election import ElectionStatus

logger = logging.getLogger(__name__)

# Si cette durée change, la page de confidentialité doit changer avec elle.
RETENTION = timedelta(days=365)

# Matricule de remplacement d'un compte anonymisé (le matricule est unique et
# obligatoire). Sert aussi à ne pas retraiter ce compte à la purge suivante.
ANONYMIZED_PREFIX = "ANON-"


@dataclass
class PurgeReport:
    voter_records: int = 0
    audit_events: int = 0
    refresh_tokens: int = 0
    students_deleted: int = 0
    students_anonymized: int = 0
    # Retirés depuis plus de 12 mois, mais encore liés à un scrutin clos depuis
    # moins de 12 mois : leur participation n'a pas fini son délai. Repris plus tard.
    students_postponed: int = 0


def purge(db: Session, *, now: datetime | None = None, dry_run: bool = False) -> PurgeReport:
    """Supprime ce qui a dépassé sa durée de conservation. `dry_run` ne touche à rien."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - RETENTION
    report = PurgeReport()

    expired_elections = select(Election.id).where(
        Election.status.in_([ElectionStatus.CLOSED, ElectionStatus.PUBLISHED]),
        Election.ends_at < cutoff,
    )

    records = db.query(VoterRecord).filter(VoterRecord.election_id.in_(expired_elections))
    report.voter_records = records.count()

    audit = db.query(AuditEvent).filter(AuditEvent.created_at < cutoff)
    report.audit_events = audit.count()

    tokens = db.query(RefreshToken).filter(RefreshToken.expires_at < now)
    report.refresh_tokens = tokens.count()

    if not dry_run:
        records.delete(synchronize_session=False)
        audit.delete(synchronize_session=False)
        tokens.delete(synchronize_session=False)

    withdrawn = (
        db.query(Student)
        .filter(
            Student.is_active.is_(False),
            Student.deactivated_at.isnot(None),
            Student.deactivated_at < cutoff,
            ~Student.matricule.startswith(ANONYMIZED_PREFIX),
        )
        .all()
    )
    for student in withdrawn:
        # Participation encore dans son délai : le compte attend. On raisonne
        # sur ce qui reste APRÈS la purge ci-dessus, pour qu'un essai à blanc
        # annonce le même résultat qu'une vraie purge.
        still_recorded = (
            db.query(VoterRecord.id)
            .filter(
                VoterRecord.student_id == student.id,
                ~VoterRecord.election_id.in_(expired_elections),
            )
            .first()
        )
        if still_recorded:
            report.students_postponed += 1
            continue

        was_candidate = (
            db.query(Candidate.id).filter(Candidate.student_id == student.id).first() is not None
        )
        if was_candidate:
            report.students_anonymized += 1
        else:
            report.students_deleted += 1
        if dry_run:
            continue

        db.query(RefreshToken).filter(RefreshToken.user_id == student.id).delete(
            synchronize_session=False
        )
        if was_candidate:
            _anonymize(student)
        else:
            db.delete(student)

    if dry_run:
        db.rollback()
    else:
        db.commit()
    logger.info("retention: %s%s", report, " (essai à blanc)" if dry_run else "")
    return report


def _anonymize(student: Student) -> None:
    """Efface tout sauf le nom, que les résultats publiés continuent d'afficher."""
    student.matricule = f"{ANONYMIZED_PREFIX}{uuid4().hex[:12].upper()}"
    student.email = None
    student.pending_email = None
    student.password_hash = None
    student.password_version += 1
    student.activation_code = None
    student.photo_url = None
    student.gender = None
    student.identity_verified = False
    student.failed_login_count = 0
    student.locked_until = None
