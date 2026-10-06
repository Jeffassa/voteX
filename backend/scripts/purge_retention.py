"""Applique les durées de conservation de la politique de confidentialité.

Voir app/services/retention_service.py pour ce qui est supprimé et quand.

Usage (avec le rôle de migration : le rôle applicatif n'a pas le droit de
supprimer dans voter_records ni dans audit_events) :

    DATABASE_URL=postgresql://smartvote_migration:…@hote/smartvote_db \
        python -m scripts.purge_retention --dry-run
    DATABASE_URL=… python -m scripts.purge_retention

À planifier au moins une fois par mois (cron, tâche planifiée) : tant qu'il ne
tourne pas, la page de confidentialité promet des durées que rien n'applique.
"""

import argparse
import sys

from sqlalchemy.exc import ProgrammingError

from app.core.database import SessionLocal
from app.services import retention_service


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge des données arrivées en fin de conservation")
    parser.add_argument("--dry-run", action="store_true", help="compte sans rien supprimer")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = retention_service.purge(db, dry_run=args.dry_run)
    except ProgrammingError as exc:
        db.rollback()
        if "permission denied" in str(exc).lower():
            print(
                "Refusé par PostgreSQL : lancez la purge avec le rôle de migration "
                "(DATABASE_URL=postgresql://smartvote_migration:…), pas avec le rôle applicatif.",
                file=sys.stderr,
            )
            return 1
        raise
    finally:
        db.close()

    verb = "à supprimer" if args.dry_run else "supprimés"
    print(f"Participations {verb} : {report.voter_records}")
    print(f"Événements d'audit {verb} : {report.audit_events}")
    print(f"Sessions expirées {verb} : {report.refresh_tokens}")
    print(f"Comptes {verb} : {report.students_deleted}")
    print(f"Comptes d'anciens candidats anonymisés : {report.students_anonymized}")
    if report.students_postponed:
        print(f"Comptes reportés (scrutin clos depuis moins de 12 mois) : {report.students_postponed}")
    if args.dry_run:
        print("Essai à blanc : rien n'a été modifié.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
