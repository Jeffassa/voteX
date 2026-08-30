"""Exposition des métriques Prometheus.

Le point d'exposition est fermé par défaut. Deux raisons :

1. `/metrics` publie la liste des routes, leurs latences et leurs volumes —
   c'est une carte de l'application, et sur une plateforme de vote le volume de
   POST /api/votes/ par tranche de temps est en soi une information sensible.
2. Un endpoint non authentifié qui parcourt tout le registre à chaque appel est
   un levier d'épuisement bon marché.

On l'active donc explicitement (`METRICS_ENABLED=true`) et, si `METRICS_TOKEN`
est défini, on exige un jeton porteur — que Prometheus sait présenter via
`authorization.credentials` dans son scrape_config.
"""

import hmac
import logging

from fastapi import FastAPI, Request, Response, status
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings


logger = logging.getLogger(__name__)

METRICS_PATH = "/metrics"


def _unauthorized() -> Response:
    return Response(status_code=status.HTTP_401_UNAUTHORIZED, content="")


def _token_is_valid(request: Request) -> bool:
    if not settings.METRICS_TOKEN:
        return True
    header = request.headers.get("authorization", "")
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer" or not credentials:
        return False
    return hmac.compare_digest(credentials, settings.METRICS_TOKEN)


def init_metrics(app: FastAPI) -> None:
    """Branche l'instrumentation et expose /metrics si la config l'autorise."""
    if not settings.METRICS_ENABLED:
        logger.info("Métriques Prometheus désactivées (METRICS_ENABLED=false).")
        return

    if settings.is_production and not settings.METRICS_TOKEN:
        # On expose quand même — refuser reviendrait à couper la supervision —
        # mais l'exploitant doit savoir que la porte est ouverte.
        logger.warning(
            "METRICS_ENABLED=true sans METRICS_TOKEN en production : %s est "
            "accessible sans authentification.",
            METRICS_PATH,
        )

    instrumentator = Instrumentator(
        should_group_status_codes=True,
        # Les chemins portent des UUID (élections, candidats, étudiants) :
        # sans regroupement, chaque identifiant créerait sa propre série et
        # ferait exploser la cardinalité côté Prometheus.
        should_instrument_requests_inprogress=True,
        excluded_handlers=[METRICS_PATH, "/healthz", "/readyz", "/health"],
        inprogress_name="smartvote_requests_inprogress",
    )
    instrumentator.instrument(app, metric_namespace="smartvote")

    @app.get(METRICS_PATH, include_in_schema=False)
    def metrics(request: Request) -> Response:
        if not _token_is_valid(request):
            logger.warning(
                "accès refusé à %s depuis %s",
                METRICS_PATH,
                request.client.host if request.client else "?",
            )
            return _unauthorized()
        from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, generate_latest

        return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

    logger.info("Métriques Prometheus exposées sur %s.", METRICS_PATH)
