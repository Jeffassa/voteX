"""Urne chiffrée (sealed_ballots) et brassage des bulletins existants

Revision ID: e2a7b9c4d1f8
Revises: c8d4f1a6e2b9
Create Date: 2026-09-30

Un bulletin inséré dans la même transaction que la participation de son auteur
portait le même `xmin` (identifiant de transaction PostgreSQL) : une jointure
sur cette colonne système reliait chaque bulletin à son électeur. Les nouveaux
bulletins passent désormais par une urne chiffrée (voir services/ballot_box.py).

Les bulletins DÉJÀ enregistrés sont réécrits ici, un par un dans un ordre
aléatoire et dans une seule transaction : ils reçoivent tous le même `xmin`,
et leurs nouvelles versions sont rangées dans un ordre sans rapport avec celui
des votes. Les anciennes versions deviennent des lignes mortes, que le VACUUM
automatique efface ; un `VACUUM votes` manuel les efface tout de suite.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e2a7b9c4d1f8"
down_revision: Union[str, None] = "c8d4f1a6e2b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "sealed_ballots" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "sealed_ballots",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("election_id", sa.Uuid(), sa.ForeignKey("elections.id"), nullable=False),
            sa.Column("sealed", sa.Text(), nullable=False),
        )
        op.create_index("ix_sealed_ballots_election_id", "sealed_ballots", ["election_id"])

    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$
            DECLARE r record;
            BEGIN
                FOR r IN SELECT id FROM votes ORDER BY random() LOOP
                    UPDATE votes SET anchor_attempts = anchor_attempts WHERE id = r.id;
                END LOOP;
            END $$;
            """
        )
        # Le rôle applicatif lit et écrit l'urne, mais ne réécrit jamais un
        # bulletin : seul le brassage supprime, une fois le bulletin versé.
        op.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'smartvote_app') THEN
                    GRANT SELECT, INSERT, DELETE ON sealed_ballots TO smartvote_app;
                    REVOKE UPDATE ON sealed_ballots FROM smartvote_app;
                END IF;
            END $$;
            """
        )


def downgrade() -> None:
    op.drop_index("ix_sealed_ballots_election_id", table_name="sealed_ballots")
    op.drop_table("sealed_ballots")
