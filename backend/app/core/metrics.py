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
from prometheus_client import (
    Counter,
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    generate_latest,
)
from prometheus_client.gc_collector import GCCollector
from prometheus_client.platform_collector import PlatformCollector
from prometheus_client.process_collector import ProcessCollector
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings


logger = logging.getLogger(__name__)

METRICS_PATH = "/metrics"


def _unauthorized() -> Response:
    return Response(status_code=status.HTTP_401_UNAUTHORIZED, content="")


# Compteur d'acheminement des emails.
#
# Un envoi qui échoue ne laissait qu'une ligne de journal : l'application
# continuait, l'interface annonçait « Code envoyé », et personne ne savait que
# rien n'était parti. Vérifié le 31/08/2026 — le fournisseur refusait TOUS les
# messages en 550 (domaine expéditeur non vérifié) sans que la supervision ne
# s'en aperçoive. Un code d'activation ou une réinitialisation qui n'arrive pas
# ferme l'accès au scrutin aussi sûrement qu'une panne.
EMAILS_TOTAL = Counter(
    "smartvote_emails_total",
    "Tentatives d'envoi d'email, par type de message et issue.",
    ["kind", "outcome"],
    # Pas d'auto-enregistrement sur le registre global : il n'est pas exposé,
    # et une seconde instanciation de l'application y lèverait un doublon.
    registry=None,
)


def _register_application_metrics(registry: CollectorRegistry) -> None:
    """Rattache les métriques applicatives au registre exposé."""
    registry.register(EMAILS_TOTAL)


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

    # Registre dédié plutôt que le registre global : celui-ci refuse deux
    # collecteurs de même nom, donc instrumenter une seconde application dans
    # le même processus (une suite de tests, un worker qui recrée l'app) levait
    # DuplicateTimeseries au démarrage.
    registry = CollectorRegistry()
    for collector in (ProcessCollector, PlatformCollector, GCCollector):
        collector(registry=registry)

    # Les métriques applicatives rejoignent ce registre. Sans cela, un compteur
    # déclaré ailleurs atterrirait sur le registre global, que `/metrics`
    # n'expose pas : la mesure existerait sans jamais être lue.
    _register_application_metrics(registry)

    instrumentator = Instrumentator(
        # Les chemins portent des UUID (élections, candidats, étudiants) :
        # sans regroupement par route, chaque identifiant créerait sa propre
        # série et ferait exploser la cardinalité côté Prometheus.
        should_group_status_codes=True,
        # `requests_inprogress` est créé sur le registre GLOBAL quel que soit le
        # registre passé ici : instrumenter une deuxième application dans le
        # même processus levait alors DuplicateTimeseries. La métrique est un
        # confort — le tableau de bord n'en dépend pas — on s'en passe.
        should_instrument_requests_inprogress=False,
        excluded_handlers=[METRICS_PATH, "/healthz", "/readyz", "/health"],
        registry=registry,
    )
    # Le registre est porté par le constructeur ; instrument() ne le reçoit pas.
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
        return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    logger.info("Métriques Prometheus exposées sur %s.", METRICS_PATH)
