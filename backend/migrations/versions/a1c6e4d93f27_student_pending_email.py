"""Adresse e-mail en attente de confirmation : students.pending_email

Revision ID: a1c6e4d93f27
Revises: f7a4c9e31b56
Create Date: 2026-09-30

Une adresse saisie par l'étudiant (activation, profil) n'est appliquée qu'après
confirmation par un lien envoyé à cette adresse. En attendant, elle vit ici.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1c6e4d93f27"
down_revision: Union[str, None] = "f7a4c9e31b56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "pending_email" in {c["name"] for c in inspector.get_columns("students")}:
        return
    op.add_column("students", sa.Column("pending_email", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("students") as batch:
        batch.drop_column("pending_email")
