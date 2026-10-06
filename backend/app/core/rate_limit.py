"""Rate limiting via slowapi.

Limites appliquées :
- POST /api/votes/ → settings.RATE_LIMIT_VOTE (défaut 5/min par IP)
- POST /api/auth/login → settings.RATE_LIMIT_LOGIN (défaut 10/min par IP)

Pour désactiver complètement, mettre les valeurs à "1000/minute" via env.

Stockage des compteurs
----------------------
Par défaut, slowapi compte en mémoire de processus. Avec plusieurs workers
uvicorn — ou plusieurs instances derrière un répartiteur — chaque processus
tient son propre compteur : une limite de 10 tentatives de connexion par minute
en autorise en réalité 10 × N. C'est précisément le scénario de production.

Si REDIS_URL est configuré (il l'est déjà pour le cache des résultats), on
partage donc les compteurs entre tous les processus. Un Redis injoignable ne
doit pas empêcher l'API de démarrer : on retombe alors sur la mémoire locale,
en le disant dans les journaux.
"""

import logging

from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


logger = logging.getLogger(__name__)


def _build_limiter() -> Limiter:
    if not settings.REDIS_URL:
        logger.info(
            "Rate limiting en mémoire de processus. Avec plusieurs workers, "
            "la limite effective est multipliée par leur nombre."
        )
        return Limiter(key_func=get_remote_address)

    try:
        limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
        # slowapi n'ouvre la connexion qu'au premier passage : on la force ici
        # pour ne pas découvrir le problème sur la première tentative de vote.
        limiter.limiter.get_window_stats("startup-probe")
        logger.info("Rate limiting partagé via Redis.")
        return limiter
    except Exception as exc:
        logger.warning(
            "Redis injoignable pour le rate limiting (%s) — repli sur la mémoire locale.",
            exc,
        )
        return Limiter(key_func=get_remote_address)


limiter = _build_limiter()


# Limites PAR COMPTE pour les envois d'e-mails déclenchés sans session (code
# d'activation, lien de réinitialisation). Sur un campus, la limite par IP est
# commune à toute une promotion : elle doit rester large. C'est la limite par
# compte qui empêche d'inonder la boîte d'un étudiant ou de faire tourner son
# code à volonté.
EMAIL_PER_ACCOUNT = ("1/minute", "5/hour")


def allow(scope: str, key: str, limits: tuple[str, ...] = EMAIL_PER_ACCOUNT) -> bool:
    """Compte une action pour `key` ; False si l'une des limites est atteinte.

    Même stockage que slowapi : partagé entre les processus quand Redis est
    configuré.
    """
    if not limiter.enabled:
        return True
    items = [parse(spec) for spec in limits]
    strategy = limiter.limiter
    if not all(strategy.test(item, scope, key) for item in items):
        return False
    for item in items:
        strategy.hit(item, scope, key)
    return True
