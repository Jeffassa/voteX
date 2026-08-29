from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import SECURITY_HEADERS, settings
from app.core.csrf import needs_csrf_check, verify_csrf
from app.core.exceptions import DomainError
from app.core.rate_limit import limiter


from app.core.monitoring import init_monitoring


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_monitoring()
    yield


# Désactive /docs et /redoc en production (COOKIE_SECURE=true = HTTPS = prod)
_docs_url = "/docs" if not settings.COOKIE_SECURE else None
_redoc_url = "/redoc" if not settings.COOKIE_SECURE else None

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

# CORS : allow_credentials=True est nécessaire pour que les cookies traversent
# la frontière origine. allow_origins doit être une liste explicite — JAMAIS "*"
# avec credentials, ça désactive silencieusement les cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-CSRF-Token"],
    expose_headers=["X-CSRF-Token"],
)


_SECURITY_HEADERS = SECURITY_HEADERS


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """Vérifie le double-submit CSRF sur les méthodes mutatives."""
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
    for k, v in _SECURITY_HEADERS.items():
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
from app.api import admin, auth, candidates, classes, elections, health, students, votes


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(classes.router, prefix="/api/classes", tags=["classes"])
app.include_router(elections.router, prefix="/api/elections", tags=["elections"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(votes.router, prefix="/api/votes", tags=["votes"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/")
def root():
    return {"name": "ESATIC SmartVote API", "version": "0.1.0", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
