"""Exposition des métriques Prometheus.

Ce fichier existe à cause d'une régression qui n'était visible qu'à l'exécution :
l'instrumentation parcourt les routes de l'application, et une version de
`prometheus-fastapi-instrumentator` trop ancienne pour la version de FastAPI
butait sur les routeurs inclus — CHAQUE requête finissait en 500. La suite
restait verte parce qu'aucun test n'activait METRICS_ENABLED.
"""

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.core import metrics as metrics_module


def _app_with_router() -> FastAPI:
    """Reproduit la structure réelle : des routeurs inclus sous un préfixe."""
    app = FastAPI()
    router = APIRouter()

    @router.get("/ping")
    def ping():
        return {"pong": True}

    app.include_router(router, prefix="/api/test")
    return app


@pytest.fixture()
def enabled(monkeypatch):
    monkeypatch.setattr(metrics_module.settings, "METRICS_ENABLED", True)
    monkeypatch.setattr(metrics_module.settings, "METRICS_TOKEN", "")


def test_instrumentation_does_not_break_routed_requests(enabled):
    app = _app_with_router()
    metrics_module.init_metrics(app)

    with TestClient(app) as client:
        assert client.get("/api/test/ping").status_code == 200


def test_metrics_endpoint_serves_prometheus_format(enabled):
    app = _app_with_router()
    metrics_module.init_metrics(app)

    with TestClient(app) as client:
        client.get("/api/test/ping")
        r = client.get(metrics_module.METRICS_PATH)

    assert r.status_code == 200
    assert "text/plain" in r.headers["content-type"]
    assert "smartvote_" in r.text


def test_metrics_are_closed_by_default(monkeypatch):
    monkeypatch.setattr(metrics_module.settings, "METRICS_ENABLED", False)
    app = _app_with_router()
    metrics_module.init_metrics(app)

    with TestClient(app) as client:
        assert client.get(metrics_module.METRICS_PATH).status_code == 404


def test_token_gates_the_endpoint(monkeypatch):
    monkeypatch.setattr(metrics_module.settings, "METRICS_ENABLED", True)
    monkeypatch.setattr(metrics_module.settings, "METRICS_TOKEN", "jeton-de-scrape")
    app = _app_with_router()
    metrics_module.init_metrics(app)

    with TestClient(app) as client:
        assert client.get(metrics_module.METRICS_PATH).status_code == 401
        assert client.get(
            metrics_module.METRICS_PATH, headers={"Authorization": "Bearer mauvais"}
        ).status_code == 401
        assert client.get(
            metrics_module.METRICS_PATH,
            headers={"Authorization": "Bearer jeton-de-scrape"},
        ).status_code == 200
