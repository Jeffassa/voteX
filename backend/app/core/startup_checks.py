"""
Module de validation de sécurité au démarrage (Startup Security Guard).

Effectue des vérifications critiques AVANT que l'application n'accepte
du trafic. Si une vérification échoue en production, l'application s'arrête
immédiatement avec un message d'erreur explicite.

Vérifications effectuées :
  1. Longueur et entropie du JWT_SECRET
  2. COOKIE_SECURE=True en production (HTTPS obligatoire)
  3. DATABASE_URL ne pointe pas vers une base de test en production
  4. Connexion effective à la base de données (circuit breaker)
"""

import logging
import sys

from app.core.config import settings

logger = logging.getLogger(__name__)


# Secrets qui circulent en clair dans le dépôt (docker-compose de dev, README,
# exemples). Quiconque a lu le repo peut forger un JWT admin avec — donc aucun
# d'entre eux ne doit jamais survivre à une mise en production.
PUBLISHED_DEV_SECRETS = frozenset(
    {
        "Z9k4vPq8rMnL3jH7sB2dX5cF1gW6tY0aQiE4uN8RsoVbPyDmCkJfAhXgZrTwLnQp",
        "Z9k4vPq8rMnL3jH7sB2dX5cF1gW6tY0aQiE4uN8RsoVbPyDmCkJfAhXgZrTwLnQpE2vSBuY1",
        "ci-testing-secret-long-enough-for-hs256-validation-purposes",
    }
)


def _is_production() -> bool:
    """ENVIRONMENT fait foi ; COOKIE_SECURE reste un filet pour les configs anciennes."""
    return settings.is_production or settings.COOKIE_SECURE


def _check_jwt_secret() -> None:
    """Vérifie que le JWT_SECRET est suffisamment long et non trivial."""
    secret = settings.JWT_SECRET
    if len(secret) < 32:
        _fail("SÉCURITÉ : JWT_SECRET trop court. Minimum 32 caractères.")
    if secret in PUBLISHED_DEV_SECRETS:
        _fail(
            "SÉCURITÉ : JWT_SECRET est un secret de développement publié dans le "
            "dépôt. Générez-en un propre : openssl rand -hex 32"
        )
    trivial_values = {"secret", "password", "changeme", "dev", "test", "1234"}
    if secret.lower() in trivial_values or "change" in secret.lower():
        _fail(
            "SÉCURITÉ : JWT_SECRET ressemble à une valeur de démonstration. "
            "Générez un secret fort : openssl rand -hex 32"
        )


def _check_cookie_security() -> None:
    """En production, les cookies doivent être sécurisés (HTTPS uniquement)."""
    if settings.is_production and not settings.COOKIE_SECURE:
        _fail(
            "SÉCURITÉ : COOKIE_SECURE=false en production. "
            "Activez HTTPS et définissez COOKIE_SECURE=true."
        )


def _check_database_not_test() -> None:
    """Évite d'utiliser une base de données de test en production."""
    db_url = settings.DATABASE_URL.lower()
    if _is_production() and ("sqlite" in db_url or "test.db" in db_url or ":memory:" in db_url):
        _fail(
            "SÉCURITÉ : DATABASE_URL pointe vers SQLite en production. "
            "Utilisez PostgreSQL."
        )


def _check_database_connection() -> None:
    """Vérifie la connexion effective à la base de données au démarrage."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        logger.info("Connexion à la base de données : OK")
    except Exception as exc:
        _fail(f"Connexion à la base de données impossible : {exc}")


def _check_cors_origins() -> None:
    """Une origine « * » vide la protection CORS de tout son sens.

    Starlette, avec allow_credentials=True, renvoie alors l'origine appelante :
    n'importe quel site peut faire des requêtes authentifiées au nom d'un
    électeur connecté. Le CSRF double-submit reste, mais on ne veut pas que la
    seule barrière tienne à lui.
    """
    origins = settings.cors_origins
    if not _is_production():
        return
    for origin in origins:
        if origin.strip() in {"*", "null"}:
            _fail(
                f"SÉCURITÉ : origine CORS {origin!r} interdite en production. "
                "Listez explicitement les domaines du frontend."
            )
        if origin.startswith("http://") and "localhost" not in origin:
            logger.warning(
                "CORS : origine en clair %s autorisée en production — les cookies "
                "Secure ne seront pas envoyés dessus.",
                origin,
            )


def _check_resend_in_production() -> None:
    """En production, l'envoi d'emails doit être configuré."""
    if _is_production() and not settings.RESEND_API_KEY:
        logger.warning(
            "AVERTISSEMENT : RESEND_API_KEY non défini en production. "
            "Les emails de confirmation de vote ne seront pas envoyés."
        )


def _fail(message: str) -> None:
    """Logue l'erreur critique et arrête le processus."""
    logger.critical("DÉMARRAGE BLOQUÉ — %s", message)
    if _is_production():
        # En production, on arrête immédiatement pour éviter un démarrage insécurisé.
        sys.exit(1)
    else:
        # En développement, on avertit sans bloquer.
        logger.warning("(Mode développement — l'arrêt est ignoré) : %s", message)


def run_startup_checks() -> None:
    """Point d'entrée principal — appelé depuis le lifespan FastAPI."""
    logger.info("Démarrage des vérifications de sécurité...")
    _check_jwt_secret()
    _check_cookie_security()
    _check_cors_origins()
    _check_database_not_test()
    _check_database_connection()
    _check_resend_in_production()
    logger.info("Vérifications de sécurité : toutes passées ✓")
