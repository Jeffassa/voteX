"""Rate limiting via slowapi.

Limites appliquées :
- POST /api/votes/ → settings.RATE_LIMIT_VOTE (défaut 5/min par IP)
- POST /api/auth/login → settings.RATE_LIMIT_LOGIN (défaut 10/min par IP)

Pour désactiver complètement, mettre les valeurs à "1000/minute" via env.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address


limiter = Limiter(key_func=get_remote_address)
