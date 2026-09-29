"""Ancrage asynchrone : votes.anchor_attempts

Revision ID: e6f3b8d20a45
Revises: d5e2a7c19b34
Create Date: 2026-09-29

Le bulletin est désormais enregistré en base AVANT d'être ancré sur la chaîne,
par un travailleur d'arrière-plan qui rejoue les échecs passagers. Ce compteur
borne les rejeux.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e6f3b8d20a45"
down_revision: Union[str, None] = "d5e2a7c19b34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "anchor_attempts" in {c["name"] for c in inspector.get_columns("votes")}:
        return
    op.add_column(
        "votes",
        sa.Column("anchor_attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    with op.batch_alter_table("votes") as batch:
        batch.drop_column("anchor_attempts")
