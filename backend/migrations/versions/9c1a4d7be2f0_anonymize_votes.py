"""Détache le bulletin de l'électeur : votes.student_id → voter_records

Revision ID: 9c1a4d7be2f0
Revises: 8eb3f0952f91
Create Date: 2026-08-30

Contexte
--------
Le schéma d'origine portait `votes.student_id NOT NULL` : chaque bulletin
désignait son auteur, donc le secret du vote n'existait pas. Le modèle
applicatif a été scindé depuis — `voter_records` enregistre QUI a voté,
`votes` enregistre CE QUI a été voté — mais aucune migration n'accompagnait
ce changement.

Sur une base créée avant la scission, l'INSERT applicatif ne renseigne plus
`student_id` et se heurte à la contrainte NOT NULL : plus aucun vote ne passe.

Cette migration transporte la participation vers `voter_records`, puis
supprime la colonne et la contrainte d'unicité qui en dépendait. Elle est
idempotente : si la colonne a déjà disparu, elle ne fait rien.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "9c1a4d7be2f0"
down_revision: Union[str, None] = "8eb3f0952f91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def _has_constraint(table: str, name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    names = {c["name"] for c in inspector.get_unique_constraints(table)}
    names |= {i["name"] for i in inspector.get_indexes(table)}
    return name in names


def upgrade() -> None:
    if not _has_column("votes", "student_id"):
        return  # base déjà au bon schéma

    # 1. La participation historique devient une ligne voter_records.
    #    ON CONFLICT : une base partiellement migrée ne doit pas planter ici.
    op.execute(
        sa.text(
            """
            INSERT INTO voter_records (id, election_id, student_id, created_at)
            SELECT gen_random_uuid(), v.election_id, v.student_id, v.created_at
            FROM votes v
            ON CONFLICT (election_id, student_id) DO NOTHING
            """
        )
    )

    # 2. La contrainte d'unicité portait sur (election_id, student_id) : elle
    #    disparaît avec la colonne, son rôle est repris par voter_records.
    if _has_constraint("votes", "uq_vote_one_per_election"):
        op.drop_constraint("uq_vote_one_per_election", "votes", type_="unique")
    if _has_constraint("votes", "ix_votes_student_id"):
        op.drop_index("ix_votes_student_id", table_name="votes")

    op.drop_column("votes", "student_id")


def downgrade() -> None:
    """Retour arrière volontairement partiel.

    Restaurer le lien bulletin → électeur reviendrait à reconstruire ce que la
    migration a détruit par conception. On recrée la colonne en NULLABLE, sans
    données : le secret du vote n'est pas réversible.
    """
    if _has_column("votes", "student_id"):
        return
    op.add_column("votes", sa.Column("student_id", sa.Uuid(), nullable=True))
    op.create_index("ix_votes_student_id", "votes", ["student_id"], unique=False)
