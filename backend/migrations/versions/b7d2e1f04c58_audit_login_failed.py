"""Ajoute l'action d'audit LOGIN_FAILED

Revision ID: b7d2e1f04c58
Revises: 9c1a4d7be2f0
Create Date: 2026-08-30

Une tentative de connexion infructueuse est le signal le plus utile d'un journal
d'audit : sans elle, une attaque par force brute ne laisse aucune trace. La
valeur doit exister dans le type énuméré PostgreSQL, sinon l'insertion échoue
avec « invalid input value for enum auditaction ».

SQLite n'a pas de type énuméré (la contrainte est portée par un CHECK que
SQLAlchemy n'émet pas ici) : la migration n'y a rien à faire.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b7d2e1f04c58"
down_revision: Union[str, None] = "9c1a4d7be2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUM_NAME = "auditaction"
NEW_VALUE = "LOGIN_FAILED"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    # IF NOT EXISTS : la migration doit pouvoir être rejouée sur une base où la
    # valeur a déjà été ajoutée à la main.
    op.execute(sa.text(f"ALTER TYPE {ENUM_NAME} ADD VALUE IF NOT EXISTS '{NEW_VALUE}'"))


def downgrade() -> None:
    """PostgreSQL ne sait pas retirer une valeur d'un type énuméré.

    La reprendre imposerait de recréer le type, de réécrire la colonne et de
    supprimer les événements qui l'utilisent — c'est-à-dire d'effacer des lignes
    d'un journal d'audit. On préfère laisser la valeur en place.
    """
    pass
