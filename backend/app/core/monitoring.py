"""Configuration du monitoring et de la remontée d'erreurs Sentry pour le backend FastAPI."""

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def init_monitoring() -> None:
    """Initialise Sentry si la variable SENTRY_DSN est définie dans l'environnement."""
    sentry_dsn = getattr(settings, "SENTRY_DSN", None)
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

            sentry_sdk.init(
                dsn=sentry_dsn,
                environment=settings.ENVIRONMENT,
                traces_sample_rate=0.1,
                profiles_sample_rate=0.1,
                integrations=[
                    FastApiIntegration(),
                    SqlalchemyIntegration(),
                ],
            )
            logger.info("Sentry SDK initialisé avec succès sur le backend.")
        except ImportError:
            logger.warning("Le package sentry-sdk n'est pas installé. Ignoré.")
    else:
        logger.info("SENTRY_DSN non configuré. Mode monitoring standard actif.")
