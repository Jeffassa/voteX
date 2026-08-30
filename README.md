# ESATIC SmartVote

Plateforme de vote en ligne pour l'élection des chefs de classe à l'ESATIC.

## Stack

- **Backend** : FastAPI + SQLAlchemy + PostgreSQL
- **Frontend** : React + Vite + TypeScript + Tailwind + Magic UI + Lordicon
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
# Backend (14 tests sur vote_service)
cd backend
pytest -v

# Smart contract (4 tests Hardhat)
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
| `VITE_CHAIN_EXPLORER_BASE` | — | ✅ | défaut Sepolia |

Sans les optionnels : pas de realtime (polling 5s), pas de hash on-chain, pas d'email envoyé. Le reste fonctionne.

## Mise en production

`ENVIRONMENT=production` durcit le démarrage : le backend refuse de démarrer si
`JWT_SECRET` est un des secrets de développement publiés dans ce dépôt, si
`COOKIE_SECURE` n'est pas activé, ou si `DATABASE_URL` pointe vers SQLite.

```bash
export ENVIRONMENT=production
export JWT_SECRET=$(openssl rand -hex 32)
export COOKIE_SECURE=true
```
