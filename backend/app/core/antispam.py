"""Filtre anti-robots des formulaires publics.

Les formulaires ouverts sans session (demande de code d'activation,
inscription, mot de passe oublié, connexion) portent un champ piège, `website`,
masqué à l'écran et retiré de l'ordre de tabulation. Un humain ne le voit pas
et le laisse vide ; un robot qui remplit tous les champs le renseigne.

Ce filtre ne remplace ni la limite de débit par IP ni le verrouillage par
compte : il écarte à coût nul le spam automatisé le plus courant, sans
CAPTCHA — donc sans script tiers sur une plateforme de vote, et sans barrière
pour les lecteurs d'écran.

À la détection, les routes qui répondent déjà de façon neutre (« si les
informations correspondent… ») renvoient la même réponse sans rien faire : le
robot n'apprend pas qu'il a été repéré.
"""

import logging

from app.core.metrics import SPAM_BLOCKED_TOTAL


logger = logging.getLogger(__name__)

HONEYPOT_FIELD = "website"


def is_bot(honeypot_value: str | None, *, form: str) -> bool:
    if honeypot_value and honeypot_value.strip():
        SPAM_BLOCKED_TOTAL.labels(form=form).inc()
        logger.info("anti-spam : soumission robotisée écartée (formulaire %s)", form)
        return True
    return False
