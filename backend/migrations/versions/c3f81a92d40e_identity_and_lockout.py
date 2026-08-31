"""Vérification d'identité et verrouillage de compte

Revision ID: c3f81a92d40e
Revises: b7d2e1f04c58
Create Date: 2026-08-30

Deux problèmes distincts, une seule migration parce qu'ils touchent la même
table.

1. `identity_verified` — Revendiquer un compte importé ne demandait que le
   matricule et le nom. Ces deux informations figurent sur n'importe quelle
   liste d'appel : le premier venu pouvait prendre le compte d'un camarade,
   qui se retrouvait ensuite bloqué (« déjà activé »). Le drapeau distingue
   les comptes dont l'identité a été confirmée par un canal contrôlé par
   l'école — adresse issue du fichier d'import, ou code envoyé à une adresse
   déjà connue — des autres, qui devront passer par une validation humaine.

   Les comptes DÉJÀ activés au moment de la migration sont marqués vérifiés :
   les rebasculer en attente déconnecterait des utilisateurs légitimes en
   pleine campagne électorale.

2. `failed_login_count` / `locked_until` — La seule protection contre les
   essais répétés était une limite par adresse IP. Dans une salle
   informatique, tous les étudiants sortent par la même IP publique : cette
   limite punissait la promotion entière tout en laissant un attaquant patient
   essayer un compte depuis chez lui. Le verrouillage porte désormais sur le
   compte visé.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3f81a92d40e"
down_revision: Union[str, None] = "b7d2e1f04c58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("identity_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "students",
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "students",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )

    # Un compte déjà activé a servi : on ne le remet pas en question ici.
    op.execute("UPDATE students SET identity_verified = true WHERE password_hash IS NOT NULL")

    # Les valeurs par défaut n'avaient d'utilité que pour remplir les lignes
    # existantes ; l'application fournit les siennes à l'insertion.
    #
    # SQLite — la base des tests — ne connaît pas `ALTER COLUMN ... DROP
    # DEFAULT` : il faut passer par le mode « batch », qui recrée la table.
    # Sans cette distinction, la migration passe sur PostgreSQL et échoue là où
    # justement on vérifie qu'elle produit le schéma attendu.
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("students") as batch:
            batch.alter_column("identity_verified", server_default=None)
            batch.alter_column("failed_login_count", server_default=None)
    else:
        op.alter_column("students", "identity_verified", server_default=None)
        op.alter_column("students", "failed_login_count", server_default=None)


def downgrade() -> None:
    op.drop_column("students", "locked_until")
    op.drop_column("students", "failed_login_count")
    op.drop_column("students", "identity_verified")
