"""Suivi des tâches planifiées : maintenance_runs

Revision ID: f5b8c2e7a9d3
Revises: e2a7b9c4d1f8
Create Date: 2026-10-06

La purge de conservation tourne une fois par mois (scripts/purge_scheduler.py).
Cette table garde la date de sa dernière exécution réussie : un service arrêté
au mauvais moment rattrape le mois manqué, et un redémarrage ne relance pas une
purge déjà faite.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f5b8c2e7a9d3"
down_revision: Union[str, None] = "e2a7b9c4d1f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if "maintenance_runs" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "maintenance_runs",
        sa.Column("name", sa.String(50), primary_key=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("maintenance_runs")
