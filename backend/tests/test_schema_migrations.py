"""Le schéma produit par Alembic doit correspondre aux modèles SQLAlchemy.

Ce test existe à cause d'un incident concret : `votes.student_id` avait été
retiré des modèles (anonymisation du bulletin) sans migration correspondante.
Les tests passaient — ils créent le schéma avec `create_all`, donc depuis les
modèles — pendant que toute base réelle gardait une colonne NOT NULL que
l'application ne renseignait plus. Résultat : plus aucun vote ne s'enregistrait.

On applique donc les migrations sur une base vierge et on compare le résultat
aux modèles. Toute divergence est une migration manquante.
"""

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from app.core.database import Base

# L'import enregistre toutes les tables sur Base.metadata
import app.models  # noqa: F401


# Différences que SQLite ne sait pas restituer fidèlement (types et valeurs par
# défaut serveur), sans rapport avec une migration manquante.
_IGNORED_KINDS = {"modify_type", "modify_default", "modify_nullable", "modify_comment"}


@pytest.fixture()
def migrated_engine(tmp_path):
    db_path = tmp_path / "migrated.db"
    url = f"sqlite:///{db_path}"

    from pathlib import Path

    base_dir = Path(__file__).resolve().parent.parent
    cfg = Config(str(base_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(base_dir / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")

    engine = create_engine(url)
    yield engine
    engine.dispose()


def test_migrations_produce_the_model_schema(migrated_engine):
    with migrated_engine.connect() as conn:
        context = MigrationContext.configure(conn)
        diff = compare_metadata(context, Base.metadata)

    significant = [
        d for d in diff
        if not (isinstance(d, tuple) and d and d[0] in _IGNORED_KINDS)
    ]
    assert not significant, (
        "Les migrations ne produisent pas le schéma des modèles. "
        f"Divergences : {significant}"
    )


def test_votes_table_has_no_link_to_the_voter(migrated_engine):
    """Le secret du vote est structurel : aucune colonne ne relie un bulletin à un électeur."""
    from sqlalchemy import inspect

    columns = {c["name"] for c in inspect(migrated_engine).get_columns("votes")}
    assert "student_id" not in columns
    assert "voter_id" not in columns
