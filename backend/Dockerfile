FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dépendances système (psycopg2 a besoin de libpq)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/
COPY alembic.ini pytest.ini ./

# L'API tourne sans privilèges : une exécution de code arbitraire dans le
# conteneur ne donne alors pas root sur le namespace du conteneur.
RUN useradd --create-home --uid 10001 smartvote     && chown -R smartvote:smartvote /app
USER smartvote

EXPOSE 8000

# Healthcheck — utile pour docker-compose depends_on
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# --proxy-headers : derrière un reverse proxy, request.client.host doit être
# l'IP réelle du client, sinon le rate limiting compte tout le trafic sur
# l'adresse du proxy et bloque tout le monde d'un coup. uvicorn ne fait
# confiance qu'à 127.0.0.1 par défaut — élargir via FORWARDED_ALLOW_IPS,
# jamais à "*" sur un port exposé publiquement (X-Forwarded-For devient
# alors falsifiable, donc le rate limit contournable).
# --no-server-header : `Server: uvicorn` annonçait la pile technique à chaque
# réponse. C'est une indication gratuite offerte à qui cherche un exploit ciblé.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-server-header"]
