"""Routes publiques sans compte : consentement et mesure d'audience.

Consentement
------------
Les seuls cookies posés sans consentement sont ceux de session (`sv_access`,
`sv_refresh`), strictement nécessaires au service. La mesure d'audience, elle,
attend l'accord du visiteur.

Le choix est conservé dans un cookie `sv_consent` httpOnly posé par le serveur,
et non dans le stockage du navigateur ni dans un cookie lisible par le script :
le frontend n'écrit jamais rien sur le poste (voir
frontend/src/test/no-browser-storage.test.ts). Il relit le choix par
`GET /api/consent`. Durée : 6 mois, après quoi la question est reposée.

Mesure d'audience
-----------------
Aucun outil tiers, aucun identifiant : chaque appel incrémente un compteur
Prometheus étiqueté par un nom de page ou d'événement pris dans une liste
fermée. Ni IP, ni utilisateur, ni UUID ne sont conservés. Sans cookie de
consentement positif, l'appel est accepté et ignoré — le serveur ne se fie pas
au seul frontend pour respecter le refus.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.database import get_db
from app.core.metrics import FRONTEND_EVENTS_TOTAL, PAGE_VIEWS_TOTAL
from app.core.rate_limit import limiter
from app.models import Election, Student, VoterRecord
from app.models.election import ElectionStatus
from app.models.student import UserRole


router = APIRouter()

CONSENT_COOKIE = "sv_consent"
CONSENT_MAX_AGE = 183 * 86400  # ~6 mois
_GRANTED, _DENIED = "analytics=1", "analytics=0"

# Gabarits de pages — jamais le chemin réel, qui porte des UUID.
PAGES = frozenset(
    {
        "landing", "login", "register", "forgot_password", "reset_password",
        "dashboard", "vote", "receipt", "results", "verify", "profile",
        "privacy", "terms", "not_found",
        "admin_dashboard", "admin_elections", "admin_election_form",
        "admin_election_detail", "admin_students", "admin_classes", "admin_audit",
    }
)

EVENTS = frozenset(
    {
        "activation_code_requested", "activation_code_failed",
        "account_activated", "account_activation_failed", "account_pending_review",
        "login_success", "login_failed",
        "vote_submitted", "vote_receipt_downloaded", "vote_verified",
    }
)


class ConsentState(BaseModel):
    # None : le visiteur n'a pas encore répondu — la bannière doit s'afficher.
    analytics: bool | None


class ConsentChoice(BaseModel):
    analytics: bool


class AnalyticsHit(BaseModel):
    kind: Literal["page", "event"]
    name: str


def _read(cookie_value: str | None) -> bool | None:
    if cookie_value == _GRANTED:
        return True
    if cookie_value == _DENIED:
        return False
    return None


@router.get("/consent", response_model=ConsentState)
def get_consent(sv_consent: Annotated[str | None, Cookie()] = None):
    return ConsentState(analytics=_read(sv_consent))


@router.put("/consent", response_model=ConsentState)
@limiter.limit("20/minute")
def set_consent(request: Request, choice: ConsentChoice, response: Response):
    response.set_cookie(
        key=CONSENT_COOKIE,
        value=_GRANTED if choice.analytics else _DENIED,
        max_age=CONSENT_MAX_AGE,
        httponly=True,
        path="/api",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
    )
    return ConsentState(analytics=choice.analytics)


@router.post("/analytics", status_code=204)
@limiter.limit("120/minute")
def record_hit(
    request: Request,
    hit: AnalyticsHit,
    sv_consent: Annotated[str | None, Cookie()] = None,
):
    if _read(sv_consent) is not True:
        return Response(status_code=204)
    if hit.kind == "page" and hit.name in PAGES:
        PAGE_VIEWS_TOTAL.labels(page=hit.name).inc()
    elif hit.kind == "event" and hit.name in EVENTS:
        FRONTEND_EVENTS_TOTAL.labels(event=hit.name).inc()
    return Response(status_code=204)


# ── État des scrutins, pour la page d'accueil ─────────────────────────────

class LiveStatus(BaseModel):
    """Chiffres agrégés de tous les scrutins en cours, sans rien par classe.

    Ce que montre déjà la page de participation à un électeur connecté, réduit à
    un total : aucun nom, aucun scrutin désigné, aucun score.
    """

    open_elections: int
    turnout_percent: int | None
    next_close_at: datetime | None


_LIVE_CACHE_KEY = "public:live-status"


@router.get("/live-status", response_model=LiveStatus)
@limiter.limit("60/minute")
def live_status(request: Request, db: Annotated[Session, Depends(get_db)]):
    cached = cache_get(_LIVE_CACHE_KEY)
    if cached is not None:
        return cached
    now = datetime.now(timezone.utc)
    running = (
        db.query(Election)
        .filter(Election.status == ElectionStatus.OPEN, Election.starts_at <= now, Election.ends_at > now)
        .all()
    )
    turnout = None
    if running:
        ids = [e.id for e in running]
        eligible = 0
        for e in running:
            eligible += (
                db.query(func.count(Student.id))
                .filter(Student.class_id == e.class_id, Student.is_active.is_(True), Student.role == UserRole.STUDENT)
                .scalar() or 0
            )
        voted = db.query(func.count(VoterRecord.id)).filter(VoterRecord.election_id.in_(ids)).scalar() or 0
        turnout = round(voted * 100 / eligible) if eligible else None
    payload = LiveStatus(
        open_elections=len(running),
        turnout_percent=turnout,
        next_close_at=min((e.ends_at for e in running), default=None),
    )
    cache_set(_LIVE_CACHE_KEY, payload.model_dump(mode="json"), ttl=30)
    return payload
