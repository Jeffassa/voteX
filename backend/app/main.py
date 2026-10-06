import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import SECURITY_HEADERS, settings
from app.core.csrf import CSRF_PROTECTED_METHODS, needs_csrf_check, origin_allowed, verify_csrf
from app.core.exceptions import DomainError
from app.core.rate_limit import limiter


from app.core.metrics import init_metrics
from app.core.monitoring import init_monitoring
from app.core.startup_checks import run_startup_checks
from app.services import anchoring_service, ballot_box


_log = logging.getLogger(__name__)


async def _maintenance_loop() -> None:
    """Brasse les urnes, puis rejoue l'ancrage des bulletins restés en attente."""
    while True:
        try:
            await asyncio.to_thread(ballot_box.sweep)
        except Exception:
            _log.exception("brassage des urnes en échec")
        if anchoring_service.chain_configured():
            try:
                await asyncio.to_thread(anchoring_service.sweep)
            except Exception:
                _log.exception("balayage d'ancrage en échec")
        await asyncio.sleep(settings.ANCHOR_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_startup_checks()   # Vérifications de sécurité avant toute requête
    init_monitoring()      # Sentry APM
    sweeper = None
    # Une base SQLite en mémoire (tests) est propre à chaque connexion : une
    # session de fond n'y verrait aucune table.
    if not settings.DATABASE_URL.startswith("sqlite:///:memory:"):
        sweeper = asyncio.create_task(_maintenance_loop())
    yield
    if sweeper:
        sweeper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweeper


# Désactive /docs et /redoc en production : l'OpenAPI complet est une carte de
# la surface d'attaque, inutile de la publier.
_expose_docs = not (settings.is_production or settings.COOKIE_SECURE)
_docs_url = "/docs" if _expose_docs else None
_redoc_url = "/redoc" if _expose_docs else None

# Swagger UI charge ses assets depuis un CDN et exécute du script inline : la
# CSP stricte de l'API les bloque et la page reste blanche. On l'exempte —
# ces routes n'existent qu'en dehors de la production.
_CSP_EXEMPT_PATHS = frozenset({"/docs", "/redoc", "/docs/oauth2-redirect"})

app = FastAPI(
    title="ESATIC SmartVote API",
    description="API du système de vote des chefs de classe ESATIC",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Instrumentation avant l'ajout des autres middlewares, pour que les temps
# mesurés incluent bien la chaîne complète.
init_metrics(app)

_SECURITY_HEADERS = SECURITY_HEADERS


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """Vérifie l'origine, puis le jeton CSRF, des requêtes mutatives."""
    if request.method in CSRF_PROTECTED_METHODS and not origin_allowed(request):
        return JSONResponse(
            status_code=403,
            content={"detail": "Origine de la requête non autorisée."},
            headers=_SECURITY_HEADERS,
        )
    if needs_csrf_check(request):
        if not verify_csrf(request):
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token manquant ou invalide."},
                headers=_SECURITY_HEADERS,
            )
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Headers HTTP de durcissement."""
    response = await call_next(request)
    exempt_csp = request.url.path in _CSP_EXEMPT_PATHS
    for k, v in _SECURITY_HEADERS.items():
        if exempt_csp and k == "Content-Security-Policy":
            continue
        response.headers[k] = v
    return response


@app.exception_handler(DomainError)
async def domain_error_handler(_request: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(_request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": f"Trop de requêtes. Réessayez dans un instant. ({exc.detail})"},
    )


from uuid import uuid4
from app.api import admin, auth, candidates, classes, elections, health, public, students, votes


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Sondes internes : Docker, Prometheus et l'orchestrateur les appellent en clair
# depuis le réseau privé. Les rediriger casserait la supervision.
_HTTPS_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/readyz", "/metrics"})


@app.middleware("http")
async def enforce_https(request: Request, call_next):
    """Redirige le trafic en clair vers HTTPS et publie HSTS.

    Enregistré après les autres middlewares, donc exécuté avant eux : une
    requête en clair est redirigée avant d'être jugée par le garde CSRF.

    Le schéma vu ici tient compte de X-Forwarded-Proto (uvicorn --proxy-headers)
    quand la requête vient d'un proxy de confiance.
    """
    if not settings.force_https or request.url.path in _HTTPS_EXEMPT_PATHS:
        return await call_next(request)
    if request.url.scheme == "http":
        # 308 et non 301 : conserve la méthode et le corps (un POST de vote
        # redirigé en GET serait perdu).
        return RedirectResponse(str(request.url.replace(scheme="https")), status_code=308)
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = (
        f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains"
    )
    return response


# CORS : allow_credentials=True est nécessaire pour que les cookies traversent
# la frontière origine. allow_origins doit être une liste explicite — JAMAIS "*"
# avec credentials, ça désactive silencieusement les cookies.
#
# Ajouté EN DERNIER, donc exécuté en premier : Starlette empile les middlewares
# du plus récent au plus externe. Quand le CORS était enregistré avant le garde
# CSRF, un rejet 403 repartait sans en-tête Access-Control-* et le navigateur le
# présentait comme une erreur réseau opaque — impossible à diagnostiquer côté SPA.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-CSRF-Token"],
    expose_headers=["X-CSRF-Token", "X-Request-ID"],
)


app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(classes.router, prefix="/api/classes", tags=["classes"])
app.include_router(elections.router, prefix="/api/elections", tags=["elections"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(votes.router, prefix="/api/votes", tags=["votes"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(public.router, prefix="/api", tags=["public"])


@app.get("/")
def root():
    return {"name": "ESATIC SmartVote API", "version": "0.1.0", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
