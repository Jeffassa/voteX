from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MaintenanceRun(Base):
    """Dernière exécution réussie d'une tâche de maintenance planifiée.

    Sert au planificateur de purge (scripts/purge_scheduler.py) à savoir si le
    mois en cours est déjà traité, même après un redémarrage, et à quiconque
    veut vérifier que la purge tourne vraiment.
    """

    __tablename__ = "maintenance_runs"

    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    last_success_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
