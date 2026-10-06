"""Date de retrait du compte : students.deactivated_at

Revision ID: c8d4f1a6e2b9
Revises: a1c6e4d93f27
Create Date: 2026-09-30

La politique de confidentialité promet la suppression d'un compte 12 mois après
la fin de la scolarité. Il fallait savoir quand le compte a été retiré : un
électeur « supprimé » après avoir voté était seulement désactivé, sans date.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c8d4f1a6e2b9"
down_revision: Union[str, None] = "a1c6e4d93f27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "deactivated_at" in {c["name"] for c in inspector.get_columns("students")}:
        return
    op.add_column("students", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("students") as batch:
        batch.drop_column("deactivated_at")
