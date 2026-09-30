# ESATIC SmartVote

Plateforme de vote en ligne pour l'élection des chefs de classe à l'ESATIC.

## Stack

- **Backend** : FastAPI + SQLAlchemy + PostgreSQL
- **Frontend** : React + Vite + TypeScript + Tailwind v4, Kokonut UI, bklit UI (graphiques), Three.js
- **Realtime** (optionnel) : Supabase Realtime
- **Blockchain** (optionnel) : Solidity + Hardhat + ethers.js + Sepolia testnet
- **Auth** : JWT + matricule ESATIC

## Structure

```
voteX/
├── backend/         FastAPI (API REST + auth + intégration blockchain + email)
├── frontend/        React (UI étudiant + admin)
├── contracts/       Smart contract Solidity + scripts Hardhat
├── supabase/        Migrations SQL Supabase
├── docker-compose.yml
└── TESTING.md       Protocole de test pas à pas
```

## 🚀 Démarrage en une commande (recommandé)

```bash
docker compose up --build
```

Ça lance :
- **Postgres** sur `localhost:5432`
- **Backend FastAPI** sur http://localhost:8000 (docs : `/docs`)
- **Frontend** sur http://localhost:5173

Le seed s'exécute automatiquement au démarrage. Tu peux te connecter immédiatement avec :

| Rôle | Matricule | Mot de passe |
|---|---|---|
| Super-admin | `SUPERADMIN` | `admin12345` |
| Étudiant | `24-ESATIC0398SB` | `student12345` |

Ces comptes sont **strictement de démonstration**. Le seed refuse de s'exécuter
avec `ENVIRONMENT=production`.

Voir [TESTING.md](TESTING.md) pour le protocole de test complet.

---

## Démarrage manuel (sans Docker)

### 1. PostgreSQL

Soit en local, soit via [Supabase](https://supabase.com) (gratuit). Si Supabase :
- Créer un projet
- Exécuter `supabase/migrations/0001_initial_schema.sql` dans le SQL Editor
- Récupérer la connection string

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements-dev.txt
cp .env.example .env       # éditer DATABASE_URL + JWT_SECRET au minimum
python -m scripts.seed     # données de démo
uvicorn app.main:app --reload
```

API : http://localhost:8000 — Docs : http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:8000 suffit
npm run dev
```

UI : http://localhost:5173

### 4. Smart contract (optionnel)

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat node                                    # blockchain locale
npx hardhat run scripts/deploy.ts --network localhost
# Copier l'adresse → backend/.env CONTRACT_ADDRESS
```

Pour Sepolia : configurer `SEPOLIA_RPC_URL` + `PRIVATE_KEY` dans `contracts/.env` puis :

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

---

## Tests

```bash
# Backend
cd backend
pytest -v

# Smart contract
cd contracts
npx hardhat test

# Avec docker
docker compose exec backend pytest -v
```

## Scripts CLI utiles

```bash
# Créer un admin manuellement
docker compose exec backend python -m scripts.create_admin \
    --matricule ADMIN0001 --first-name Yao --last-name Konan \
    --email yao@esatic.ci --password 'change-me' --role admin

# Re-seed (idempotent)
docker compose exec backend python -m scripts.seed
```

## Variables d'environnement

| Variable | Backend | Frontend | Optionnel |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | non |
| `JWT_SECRET` | ✅ | — | non |
| `ENVIRONMENT` | ✅ | — | défaut `development` |
| `FRONTEND_URL` | ✅ | — | défaut OK |
| `SUPABASE_*` | — | ✅ | oui (Realtime) |
| `WEB3_RPC_URL` / `CONTRACT_ADDRESS` / `ADMIN_PRIVATE_KEY` | ✅ | — | oui (blockchain) |
| `MAIL_*` | ✅ | — | oui (email reçu) |
| `ANCHOR_INTERVAL_SECONDS` | ✅ | — | défaut 15 (rejeu de l'ancrage on-chain) |
| `VITE_CHAIN_EXPLORER_BASE` | — | ✅ | défaut Sepolia |
| `VITE_API_URL` | — | ✅ | **requis au build de production** |
| `VITE_SITE_URL` | — | ✅ | défaut `https://smartvote.esatic.ci` (SEO, partage) |
| `FORCE_HTTPS` / `HSTS_MAX_AGE` | ✅ | — | défaut : actif en production |

Sans les optionnels : pas de realtime (polling 5s), pas de hash on-chain, pas d'email envoyé. Le reste fonctionne.

## Supervision (optionnelle)

```bash
docker compose up -d                                  # l'app crée le réseau votex-network
docker compose -f docker-compose.monitoring.yml up -d  # s'y raccroche
```

- Prometheus : http://localhost:9090 — Grafana : http://localhost:3000
- Le backend n'expose `/metrics` que si `METRICS_ENABLED=true` (déjà positionné
  dans `docker-compose.yml`). En production, protégez-le avec `METRICS_TOKEN` et
  renseignez le bloc `authorization` du job `backend` dans
  `monitoring/prometheus/prometheus.yml`.
- Les deux stacks sont des projets Compose distincts : démarrez l'application en
  premier, sinon le réseau `votex-network` n'existe pas encore.

## Mise en production

### Architecture : API et frontend séparés

L'API et le frontend sont deux services, sur deux origines, par exemple
`https://api.smartvote.esatic.ci` et `https://smartvote.esatic.ci`. Deux
sous-domaines d'un même domaine restent « same-site » : les cookies de session
(`SameSite=Lax/Strict`) y circulent.

```bash
# Frontend : l'URL de l'API est figée dans le bundle (le build échoue sans elle)
docker build -f frontend/Dockerfile.prod \
  --build-arg VITE_API_URL=https://api.smartvote.esatic.ci \
  --build-arg VITE_SITE_URL=https://smartvote.esatic.ci \
  -t smartvote-frontend frontend
docker run -e API_ORIGIN=https://api.smartvote.esatic.ci -p 8080:80 smartvote-frontend

# Backend : FRONTEND_URL=https://smartvote.esatic.ci (CORS + cookies)
```

Les deux conteneurs écoutent en clair derrière un reverse proxy qui termine
TLS et transmet `X-Forwarded-Proto` : ils redirigent alors tout accès en `http`
vers `https` (308) et publient HSTS.

### Avant d'ouvrir le site au public

- Compléter les mentions marquées **[À COMPLÉTER]** dans
  `frontend/src/pages/legal/PrivacyPage.tsx` (responsable du traitement,
  contact, hébergeur, durées de conservation) et `TermsPage.tsx`.
- Vérifier le domaine d'envoi des emails (voir `SECURITY.md`).

### Mesure d'audience

Maison, sans cookie ni outil tiers, et seulement après consentement : chaque
page vue incrémente `smartvote_page_views_total{page}` (gabarit de page, jamais
l'URL réelle). Tableau de bord Grafana « SmartVote ». Le choix du visiteur est
gardé dans un cookie httpOnly `sv_consent` ; le serveur ignore toute mesure
sans accord.

### Images

Icônes, favicon et image de partage sont générés depuis `public/favicon.svg` :

```bash
cd frontend
node scripts/generate-assets.mjs
python scripts/compress-images.py
```

### Durcissement au démarrage

`ENVIRONMENT=production` durcit le démarrage : le backend refuse de démarrer si
`JWT_SECRET` est un des secrets de développement publiés dans ce dépôt, si
`COOKIE_SECURE` n'est pas activé, ou si `DATABASE_URL` pointe vers SQLite.

```bash
export ENVIRONMENT=production
export JWT_SECRET=$(openssl rand -hex 32)
export COOKIE_SECURE=true
```
