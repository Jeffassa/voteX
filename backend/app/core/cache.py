"""
Couche de cache Redis pour ESATIC SmartVote.

Pattern : Cache-Aside (Lazy Loading)
  - On lit depuis Redis. Si absent (cache miss), on calcule et on stocke.
  - On invalide le cache explicitement après chaque mutation.

Mode Passthrough :
  - Si REDIS_URL est vide ou Redis est injoignable, toutes les opérations
    tombent en mode passthrough silencieux (pas d'exception levée).
  - L'application fonctionne normalement, sans cache.

Clés utilisées :
  - election:results:{election_id}   → ElectionResults (JSON)
  - election:list:class:{class_id}   → list[Election] (JSON)
"""

import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Client Redis singleton — None si non configuré ou en erreur de connexion.
_redis: Any = None


def _get_client() -> Any | None:
    """Retourne le client Redis singleton, ou None si non disponible."""
    global _redis
    if _redis is not None:
        return _redis
    if not settings.REDIS_URL:
        return None
    try:
        import redis as redis_lib  # Import différé pour ne pas bloquer si non installé

        client = redis_lib.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        # Test de connexion immédiat
        client.ping()
        _redis = client
        logger.info("Cache Redis connecté sur %s", settings.REDIS_URL)
        return _redis
    except Exception as exc:
        logger.warning("Cache Redis indisponible (mode passthrough) : %s", exc)
        return None


def cache_get(key: str) -> dict | list | None:
    """Récupère une valeur depuis le cache. Retourne None si absent ou erreur."""
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Erreur lecture cache [%s] : %s", key, exc)
        return None


def cache_set(key: str, value: dict | list, ttl: int | None = None) -> None:
    """Stocke une valeur en cache avec TTL. Ne lève pas d'exception si Redis est absent."""
    client = _get_client()
    if client is None:
        return
    ttl = ttl or settings.CACHE_TTL_SECONDS
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("Erreur écriture cache [%s] : %s", key, exc)


def cache_delete(key: str) -> None:
    """Invalide une entrée du cache. Ne lève pas d'exception si Redis est absent."""
    client = _get_client()
    if client is None:
        return
    try:
        client.delete(key)
    except Exception as exc:
        logger.warning("Erreur suppression cache [%s] : %s", key, exc)


def cache_delete_pattern(pattern: str) -> None:
    """Invalide toutes les clés correspondant au pattern (ex: 'election:*'). Utilise SCAN."""
    client = _get_client()
    if client is None:
        return
    try:
        keys = list(client.scan_iter(match=pattern, count=100))
        if keys:
            client.delete(*keys)
    except Exception as exc:
        logger.warning("Erreur suppression pattern cache [%s] : %s", pattern, exc)


# ──────────────────────────────────────────────────────────────────────────────
# Clés canoniques — centralisées ici pour éviter les typos
# ──────────────────────────────────────────────────────────────────────────────

def key_election_results(election_id: str) -> str:
    return f"election:results:{election_id}"


def key_election_list_class(class_id: str) -> str:
    return f"election:list:class:{class_id}"
