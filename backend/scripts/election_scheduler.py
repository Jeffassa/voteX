"""Clôt les scrutins à leur heure de fin et relance les non-votants, chaque minute.

C'est le service `scheduler` du docker-compose. En production, même image et
même configuration que l'API (rôle applicatif de la base, JWT_SECRET pour
vider l'urne chiffrée, SMTP pour les relances) :

    docker run -d --name smartvote-scheduler --restart unless-stopped \
        --env-file backend.env smartvote-backend python -m scripts.election_scheduler

Une instance suffit ; une seconde ne doublerait rien (verrous SKIP LOCKED,
relance datée avant l'envoi). Logique et règles : app/services/election_scheduler.py.
"""

import logging
import sys
import time

from app.core.database import SessionLocal
from app.services import election_scheduler

logger = logging.getLogger("election_scheduler")

CHECK_EVERY_SECONDS = 60


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s : %(message)s")
    logger.info("planificateur des scrutins démarré (vérification toutes les %s s)", CHECK_EVERY_SECONDS)
    while True:
        db = SessionLocal()
        try:
            report = election_scheduler.run_once(db)
            if report.closed or report.reminded:
                logger.info("scrutins clos : %d, relances envoyées : %d", report.closed, report.reminded)
        except Exception:
            # Base pas encore migrée, réseau… : on réessaie au tour suivant.
            db.rollback()
            logger.exception("tour du planificateur en échec")
        finally:
            db.close()
        time.sleep(CHECK_EVERY_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
