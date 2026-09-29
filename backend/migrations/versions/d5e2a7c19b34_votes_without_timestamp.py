"""Retire l'horodatage du bulletin : votes.created_at

Revision ID: d5e2a7c19b34
Revises: c3f81a92d40e
Create Date: 2026-09-29

Contexte
--------
`voter_records.created_at` et `votes.created_at` valaient `now()` dans la même
transaction. PostgreSQL fige `now()` au début de la transaction : les deux
lignes portaient donc exactement la même heure, et une jointure sur cet
horodatage rattachait chaque bulletin à son électeur — l'inverse du secret que
la scission des deux tables devait garantir.

Le moment de la participation reste dans `voter_records`. Le bulletin, lui, n'a
plus d'heure. Les horodatages existants sont perdus : c'est le but.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d5e2a7c19b34"
down_revision: Union[str, None] = "c3f81a92d40e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    if _has_column("votes", "created_at"):
        with op.batch_alter_table("votes") as batch:
            batch.drop_column("created_at")


def downgrade() -> None:
    """Restaure la colonne vide : l'heure d'origine n'est pas reconstituable."""
    if not _has_column("votes", "created_at"):
        op.add_column("votes", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
