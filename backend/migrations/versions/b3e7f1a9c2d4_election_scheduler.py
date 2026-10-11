"""Tâche planifiée des scrutins : date de relance, action de journal

Revision ID: b3e7f1a9c2d4
Revises: a4d8e2f6b1c9
Create Date: 2026-10-11

scripts/election_scheduler.py clôt les scrutins à leur heure de fin et relance
par e-mail les non-votants avant la clôture.
- elections.reminder_sent_at : posée à l'envoi, elle empêche une seconde
  relance du même scrutin (redémarrage du service, plusieurs instances).
- auditaction gagne ELECTION_REMINDER_SENT (PostgreSQL : type énuméré).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b3e7f1a9c2d4"
down_revision: Union[str, None] = "a4d8e2f6b1c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("elections")}
    if "reminder_sent_at" not in columns:
        op.add_column("elections", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'ELECTION_REMINDER_SENT'"))


def downgrade() -> None:
    # La valeur du type énuméré reste en place : la retirer imposerait d'effacer
    # des lignes du journal d'audit (voir b7d2e1f04c58).
    op.drop_column("elections", "reminder_sent_at")
