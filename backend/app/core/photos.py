"""Adresses de photos : seulement chez un hébergeur que l'école a choisi.

Une photo de profil ou de candidat est chargée par le navigateur de CHAQUE
personne qui affiche la page. Hébergée n'importe où, elle transmettait
l'adresse IP, le navigateur et l'heure de visite de tous les électeurs à ce
tiers — exactement ce que la politique de confidentialité exclut (« aucun
tiers »). La liste PHOTO_ALLOWED_HOSTS est vide par défaut : aucune photo
extérieure. Le frontend applique la même liste dans sa CSP (PHOTO_ORIGINS).
"""

from urllib.parse import urlsplit

from app.core.config import settings


def check_photo_url(value: object) -> str | None:
    """Valide une adresse de photo ; lève ValueError (→ 422) sinon."""
    if value is None:
        return None
    url = str(value).strip()
    if not url:
        return None
    parts = urlsplit(url)
    allowed = settings.photo_hosts
    if parts.scheme != "https" or not parts.hostname or parts.hostname.lower() not in allowed:
        if not allowed:
            raise ValueError(
                "Les photos hébergées hors de la plateforme ne sont pas acceptées : "
                "l'adresse IP de chaque visiteur partirait chez cet hébergeur."
            )
        raise ValueError(f"Hébergeur de photo non autorisé. Autorisés : {', '.join(allowed)}.")
    return url
