"""Gardes de démarrage : ce qu'une mise en production ne doit pas laisser passer."""

import re
from pathlib import Path

import pytest

from app.core import startup_checks
from app.core.config import settings
from app.services import email_service

REPO = Path(__file__).resolve().parents[2]


def _published_jwt_secrets() -> set[str]:
    """Toute valeur de JWT_SECRET écrite en clair dans le dépôt."""
    found = set()
    for path in [REPO / "docker-compose.yml", *sorted((REPO / ".github" / "workflows").glob("*.yml"))]:
        text = path.read_text(encoding="utf-8")
        found.update(re.findall(r"JWT_SECRET:\s*\$\{JWT_SECRET:-([^}]+)\}", text))
        found.update(re.findall(r"JWT_SECRET:\s*([A-Za-z0-9_-]{32,})\s*$", text, re.M))
    return found


def test_every_secret_published_in_the_repo_is_refused_in_production():
    """La valeur par défaut du docker-compose manquait à la liste : on relit les fichiers."""
    published = _published_jwt_secrets()
    assert published, "le motif ne trouve plus aucun secret : à mettre à jour"
    assert published <= startup_checks.PUBLISHED_DEV_SECRETS, published - startup_checks.PUBLISHED_DEV_SECRETS


@pytest.fixture()
def production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    failures = []
    monkeypatch.setattr(startup_checks, "_fail", failures.append)
    return failures


def test_metrics_without_token_block_production(production, monkeypatch):
    monkeypatch.setattr(settings, "METRICS_ENABLED", True)
    monkeypatch.setattr(settings, "METRICS_TOKEN", "")
    startup_checks._check_metrics_token()
    assert production and "METRICS_TOKEN" in production[0]


def test_metrics_with_token_pass(production, monkeypatch):
    monkeypatch.setattr(settings, "METRICS_ENABLED", True)
    monkeypatch.setattr(settings, "METRICS_TOKEN", "x" * 64)
    startup_checks._check_metrics_token()
    assert production == []


def test_codes_and_links_never_reach_production_logs(monkeypatch):
    secret = "https://smartvote.example/reset-password#token=abc"
    assert email_service.loggable(secret) == secret  # développement : seul chemin sans SMTP
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert secret not in email_service.loggable(secret)
