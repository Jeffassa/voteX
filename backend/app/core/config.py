from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Identité du jeton — protège contre la réutilisation cross-app si le secret fuite.
JWT_ISSUER = "esatic-smartvote"
JWT_AUDIENCE = "esatic-smartvote-api"

# Longueur minimale du secret JWT. 32 octets = 256 bits, recommandé pour HS256.
MIN_JWT_SECRET_LENGTH = 32
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
}


class Settings(BaseSettings):
    JWT_ALGORITHM: str = "HS256"

    @field_validator("JWT_ALGORITHM")
    @classmethod
    def _validate_jwt_algorithm(cls, v: str) -> str:
        if v != "HS256":
            raise ValueError("Seul l'algorithme HS256 est autorisé pour JWT_ALGORITHM.")
        return v
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # Environnement de déploiement : "development" | "staging" | "production".
    # Sert de source de vérité pour les gardes de démarrage et pour Sentry —
    # avant, la production était devinée à partir de COOKIE_SECURE.
    ENVIRONMENT: str = "development"

    DATABASE_URL: str

    # Supabase — optionnel pour le backend (utilisé par le frontend pour Realtime).
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    JWT_SECRET: str
    # Access token court (15 min) — vol minimisé. Refresh token long (7 jours) —
    # rotation à chaque usage.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Conservé pour compat ascendante (tests legacy)
    JWT_EXPIRE_MINUTES: int = 15

    # Cookies d'auth — voir app/core/cookies.py
    # En prod, met COOKIE_SECURE=true (HTTPS obligatoire). En dev sur localhost: false.
    COOKIE_SECURE: bool = False
    # samesite : "lax" (recommandé), "strict" (plus sécurisé mais casse les redirects),
    # ou "none" (uniquement avec Secure=true et CORS strict)
    COOKIE_SAMESITE: str = "strict"
    # Mettre à ".esatic.ci" en prod si tu veux partager le cookie entre sous-domaines
    COOKIE_DOMAIN: str = ""

    # Blockchain — best-effort. Si vide, le système dégrade en hash off-chain.
    WEB3_RPC_URL: str = ""
    CONTRACT_ADDRESS: str = ""
    ADMIN_PRIVATE_KEY: str = ""

    # Email — best-effort. Si vide, pas d'envoi.
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@esatic-smartvote.ci"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = ""
    MAIL_FROM_NAME: str = "ESATIC SmartVote"

    # Resend Email Configuration
    RESEND_API_KEY: str = ""
    RESEND_DOMAIN_FROM: str = "no-reply@itgala-esatic.org"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    EXTRA_CORS_ORIGINS: str = ""

    # Rate limiting
    #
    # Ces limites sont par ADRESSE IP. Sur un campus, une promotion entière sort
    # par la même IP publique : une limite serrée y bloquerait les étudiants les
    # uns après les autres un jour de scrutin, sans gêner un attaquant opérant
    # depuis chez lui. Elles servent donc à protéger l'infrastructure d'un
    # afflux anormal, pas à protéger les comptes.
    #
    # Contre les essais de mots de passe, la défense est le verrouillage
    # progressif du COMPTE visé — voir auth_service.LOCKOUT_STEPS.
    RATE_LIMIT_VOTE: str = "30/minute"
    RATE_LIMIT_LOGIN: str = "60/minute"

    # Monitoring — si vide, Sentry n'est pas initialisé.
    SENTRY_DSN: str = ""

    # Métriques Prometheus — voir app/core/metrics.py. Fermé par défaut :
    # /metrics décrit toute la surface de l'API et le rythme des votes.
    METRICS_ENABLED: bool = False
    METRICS_TOKEN: str = ""

    # Cache Redis — optionnel. Si vide, le cache est désactivé (mode passthrough).
    REDIS_URL: str = ""
    # Durée de vie des résultats d'élections fermées en cache (en secondes). 5 minutes par défaut.
    CACHE_TTL_SECONDS: int = 300

    @field_validator("JWT_SECRET")
    @classmethod
    def _validate_jwt_secret(cls, v: str) -> str:
        if len(v) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET trop court ({len(v)} caractères). "
                f"Minimum {MIN_JWT_SECRET_LENGTH} caractères requis pour HS256. "
                f"Génère un secret fort avec : openssl rand -hex 32"
            )
        # Garde-fou contre les valeurs de démo / placeholders évidents
        forbidden = {"change-me", "secret", "dev", "test", "password", "1234"}
        if v.lower() in forbidden or any(f in v.lower() for f in ("change-me", "your-secret")):
            raise ValueError(
                "JWT_SECRET ressemble à une valeur de démo. "
                "Utilise un secret aléatoire en production."
            )
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.FRONTEND_URL]
        if self.EXTRA_CORS_ORIGINS:
            origins.extend(o.strip() for o in self.EXTRA_CORS_ORIGINS.split(",") if o.strip())
        return origins


settings = Settings()
