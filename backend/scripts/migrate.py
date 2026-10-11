"""Amène le schéma de la base à jour, y compris depuis une base non versionnée.

Pourquoi ce script plutôt qu'un simple `alembic upgrade head` :

Les premiers déploiements créaient les tables avec `Base.metadata.create_all()`,
sans jamais écrire dans `alembic_version`. Alembic voit donc une base « vierge »
et rejoue la migration initiale, qui échoue immédiatement (« table already
exists ») — et le schéma reste bloqué dans son état d'origine.

On distingue donc trois cas :
  - base vide           → upgrade head (tout se crée dans l'ordre)
  - base non versionnée → stamp de la révision initiale, puis upgrade head
  - base déjà versionnée→ upgrade head
"""

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings


BASE_DIR = Path(__file__).resolve().parent.parent
INITIAL_REVISION = "8eb3f0952f91"


def _alembic_config() -> Config:
    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    return cfg


def main() -> int:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()

    cfg = _alembic_config()

    if not tables:
        print("Base vide → création complète du schéma.")
    elif "alembic_version" not in tables:
        print(
            "Base existante sans historique Alembic → marquage à la révision "
            f"initiale ({INITIAL_REVISION}) avant mise à jour."
        )
        command.stamp(cfg, INITIAL_REVISION)
    else:
        print("Base déjà versionnée → mise à jour incrémentale.")

    command.upgrade(cfg, "head")
    print("Schéma à jour.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
