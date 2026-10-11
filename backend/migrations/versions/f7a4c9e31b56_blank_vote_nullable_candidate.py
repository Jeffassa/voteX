"""Vote blanc : votes.candidate_id devient nullable

Revision ID: f7a4c9e31b56
Revises: e6f3b8d20a45
Create Date: 2026-09-29

Le modèle accepte un bulletin sans candidat (vote blanc) depuis son
introduction, mais le schéma initial avait créé `votes.candidate_id NOT NULL`.
Sur PostgreSQL, chaque vote blanc échouait donc sur la contrainte ; le filet
d'IntegrityError de vote_service le présentait comme « Vous avez déjà voté ».

Le test de dérive schéma/migrations ne l'a pas vu : il tourne sur SQLite et
ignore les différences de nullabilité, que SQLite restitue mal.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f7a4c9e31b56"
down_revision: Union[str, None] = "e6f3b8d20a45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("votes") as batch:
        batch.alter_column("candidate_id", existing_type=sa.Uuid(), nullable=True)


def downgrade() -> None:
    # Échoue s'il existe des votes blancs : les supprimer effacerait des
    # bulletins, ce qu'aucun retour arrière ne doit faire en silence.
    with op.batch_alter_table("votes") as batch:
        batch.alter_column("candidate_id", existing_type=sa.Uuid(), nullable=False)
