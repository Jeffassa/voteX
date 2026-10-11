"""Lance la purge de conservation une fois par mois, sans intervention.

C'est le service `purge` du docker-compose ; en production, le même conteneur
tourne avec le rôle de migration (le rôle applicatif ne peut pas supprimer
dans voter_records ni dans audit_events, et c'est voulu) :

    docker run -d --name smartvote-purge --restart unless-stopped \\
        -e DATABASE_URL=postgresql://smartvote_migration:…@hote/smartvote_db \\
        -e JWT_SECRET=… smartvote-backend python -m scripts.purge_scheduler

Règle : une purge par mois civil, à partir du 1er à 03:00 UTC (heure
d'Abidjan). La date de la dernière purge réussie est gardée en base
(`maintenance_runs`) : un service arrêté le 1er rattrape le mois dès son
redémarrage, et un redémarrage ne relance pas une purge déjà faite.
"""

import logging
import sys
import time
from datetime import datetime, timezone

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.maintenance import MaintenanceRun
from app.services import retention_service

logger = logging.getLogger("purge_scheduler")

TASK = "retention_purge"
RUN_HOUR_UTC = 3
CHECK_EVERY_SECONDS = 3600
# Après un échec (base pas encore migrée, réseau…), on réessaie plus tôt.
RETRY_AFTER_SECONDS = 300


def is_due(now: datetime, last_success: datetime | None) -> bool:
    """Vrai si le mois civil de `now` n'a pas encore eu sa purge.

    Le 1er du mois, on attend RUN_HOUR_UTC ; ensuite, un mois sans purge est
    rattrapé à la première vérification. Sans aucune purge connue, tout de suite.
    """
    if last_success is None:
        return True
    if last_success.tzinfo is None:  # SQLite rend un datetime naïf
        last_success = last_success.replace(tzinfo=timezone.utc)
    if (now.year, now.month) == (last_success.year, last_success.month):
        return False
    return now.day > 1 or now.hour >= RUN_HOUR_UTC


def run_once(db: Session, now: datetime | None = None) -> bool:
    """Purge si c'est dû. Retourne True si une purge a eu lieu."""
    now = now or datetime.now(timezone.utc)
    record = db.get(MaintenanceRun, TASK)
    if not is_due(now, record.last_success_at if record else None):
        return False

    report = retention_service.purge(db, now=now)
    summary = (
        f"participations={report.voter_records} audit={report.audit_events} "
        f"sessions={report.refresh_tokens} comptes_supprimés={report.students_deleted} "
        f"comptes_anonymisés={report.students_anonymized} reportés={report.students_postponed}"
    )
    record = db.get(MaintenanceRun, TASK) or MaintenanceRun(name=TASK, last_success_at=now)
    record.last_success_at = now
    record.summary = summary
    db.add(record)
    db.commit()
    logger.info("purge mensuelle faite : %s", summary)
    return True


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s : %(message)s")
    logger.info("planificateur de purge démarré (le 1er de chaque mois, %02d:00 UTC)", RUN_HOUR_UTC)
    while True:
        db = SessionLocal()
        wait = CHECK_EVERY_SECONDS
        try:
            run_once(db)
        except ProgrammingError as exc:
            db.rollback()
            wait = RETRY_AFTER_SECONDS
            if "permission denied" in str(exc).lower():
                logger.critical(
                    "purge refusée par PostgreSQL : ce service doit utiliser le rôle de "
                    "migration (DATABASE_URL=postgresql://smartvote_migration:…)."
                )
            else:
                logger.exception("purge en échec, nouvel essai dans %s s", wait)
        except Exception:
            db.rollback()
            wait = RETRY_AFTER_SECONDS
            logger.exception("purge en échec, nouvel essai dans %s s", wait)
        finally:
            db.close()
        time.sleep(wait)


if __name__ == "__main__":
    sys.exit(main())
