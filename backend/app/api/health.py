"""Endpoints de santé (Health & Readiness Probes) pour Kubernetes, Docker et le monitoring."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/healthz", status_code=status.HTTP_200_OK)
def liveness() -> dict[str, str]:
    """Sert de sondage de viabilité (Liveness probe).
    Indique que le conteneur backend est en cours d'exécution.
    """
    return {"status": "ok", "service": "smartvote-backend"}


@router.get("/readyz")
def readiness(db: Annotated[Session, Depends(get_db)]) -> JSONResponse:
    """Sert de sondage de disponibilité (Readiness probe).
    Vérifie la connexion active avec la base de données PostgreSQL.
    """
    try:
        # Exécute un ping SQL léger
        db.execute(text("SELECT 1"))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ready", "database": "connected"},
        )
    except Exception:
        # Le détail (hôte, utilisateur, message du pilote) reste au journal :
        # la sonde est publique.
        logger.exception("readyz: base de données injoignable")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": "unavailable"},
        )
