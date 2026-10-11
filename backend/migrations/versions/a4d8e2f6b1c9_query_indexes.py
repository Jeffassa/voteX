"""Index des requêtes courantes, et recherche d'étudiants en trigrammes

Revision ID: a4d8e2f6b1c9
Revises: f5b8c2e7a9d3
Create Date: 2026-10-11

Clés étrangères sans index, que PostgreSQL ne crée pas de lui-même :
- students.class_id : liste filtrée par classe, inscrits d'un scrutin,
  participation par classe du tableau de bord ;
- elections (class_id, starts_at) : scrutins d'une classe, du plus récent au
  plus ancien ;
- candidates.student_id : la contrainte unique (election_id, student_id) ne
  sert pas les recherches par étudiant.

Recherche « contient » sur les étudiants (ILIKE '%…%' sur matricule, nom,
prénom, e-mail) : un index B-tree n'y sert à rien, un index GIN en trigrammes
(extension pg_trgm) si. PostgreSQL uniquement. pg_trgm est une extension
« de confiance » depuis PostgreSQL 13 : le propriétaire de la base peut la
créer. Si le rôle de migration n'en a pas le droit, la migration passe sans
ces index (la recherche reste correcte, seulement plus lente) et le dit.
"""
import logging
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a4d8e2f6b1c9"
down_revision: Union[str, None] = "f5b8c2e7a9d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

# Index en trigrammes : noms terminés par _trgm, que migrations/env.py exclut
# de l'autogénération (ils n'existent pas dans les modèles).
TRGM_COLUMNS = ("matricule", "first_name", "last_name", "email")


def _existing_indexes(table: str) -> set[str]:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    if "ix_students_class_id" not in _existing_indexes("students"):
        op.create_index("ix_students_class_id", "students", ["class_id"])
    if "ix_elections_class_id_starts_at" not in _existing_indexes("elections"):
        op.create_index("ix_elections_class_id_starts_at", "elections", ["class_id", "starts_at"])
    if "ix_candidates_student_id" not in _existing_indexes("candidates"):
        op.create_index("ix_candidates_student_id", "candidates", ["student_id"])

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    # Point de sauvegarde : un refus de CREATE EXTENSION annulerait sinon
    # toute la transaction de migration.
    savepoint = bind.begin_nested()
    try:
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        savepoint.commit()
    except sa.exc.DBAPIError as exc:
        savepoint.rollback()
        logger.warning(
            "pg_trgm indisponible pour ce rôle (%s) : recherche d'étudiants sans index trigrammes.",
            exc.orig,
        )
        return
    for column in TRGM_COLUMNS:
        bind.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_students_{column}_trgm "
            f"ON students USING gin ({column} gin_trgm_ops)"
        ))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for column in TRGM_COLUMNS:
            bind.execute(sa.text(f"DROP INDEX IF EXISTS ix_students_{column}_trgm"))
    op.drop_index("ix_candidates_student_id", table_name="candidates")
    op.drop_index("ix_elections_class_id_starts_at", table_name="elections")
    op.drop_index("ix_students_class_id", table_name="students")
