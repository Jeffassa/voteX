# Guide de test ESATIC SmartVote

Protocole pour valider l'application end-to-end. Compte une bonne **20 minutes** pour tout dérouler.

## 1. Démarrer la stack

```bash
docker compose up --build
```

Attends que tu voies dans les logs :

```
smartvote-backend  | > Mise à jour du schéma (Alembic)...
smartvote-backend  | Schéma à jour.
smartvote-backend  | > Seed des données de démo...
smartvote-backend  | Seed OK :
smartvote-backend  |   super-admin : matricule=SUPERADMIN  password=admin12345
smartvote-backend  |   voter démo  : matricule=24-ESATIC0398SB  password=student12345  (Sékou Bamba)
smartvote-backend  |   élection    : Chef de classe — L3 Génie Logiciel (open)
smartvote-backend  |   classes     : L3 Génie Logiciel, L3 Réseaux Télécoms, L3 Cybersécurité, L3 Intelligence Artificielle
smartvote-backend  | INFO:     Uvicorn running on http://0.0.0.0:8000
smartvote-frontend | VITE v5.x.x  ready in N ms
smartvote-frontend |   ➜  Local:   http://localhost:5173/
```

**Vérif rapide** :
- API : http://localhost:8000/health → `{"status":"healthy"}`
- API docs : http://localhost:8000/docs (Swagger)
- App : http://localhost:5173

---

## 2. Test du flow étudiant

### 2.1 Landing page (déconnecté)

1. Ouvre http://localhost:5173
2. ✅ Tu vois la landing avec le titre "Le vote des chefs de classe, _réinventé._"
3. ✅ Les 3 piliers (Sécurisé / Temps réel / Blockchain) avec icônes Lordicon animées
4. ✅ Le bandeau navy en bas avec le NumberTicker qui anime les chiffres

### 2.2 Login

1. Clique **Se connecter avec mon matricule**
2. Rentre `24-ESATIC0398SB` / `student12345`
3. ✅ Redirige vers le dashboard
4. ✅ Toast vert "Connexion réussie"

### 2.3 Dashboard étudiant

1. ✅ "Bonjour, Sékou."
2. ✅ Matricule + classe affichés
3. ✅ Carte "Chef de classe — L3 Génie Logiciel" avec :
   - Badge vert pulsant "Scrutin ouvert"
   - Countdown j/h/m/s
   - Bordure animée (BorderBeam) si pas encore voté
   - Bouton orange "Voter maintenant"

### 2.4 Salle de vote

1. Clique **Voter maintenant**
2. ✅ Carte orange "Règles du scrutin"
3. ✅ Grille de 4 candidats (Aïcha, Yao, Mariam, Ibrahim) avec slogans + 3 puces de programme
4. Clique **Voir le profil détaillé** sur Yao Konan
5. ✅ Modale s'ouvre avec bio + programme numéroté + citation en italique serif
6. Clique **Choisir ce candidat**
7. ✅ Modal se ferme, le candidat apparaît sélectionné (bordure orange + check)
8. ✅ La barre flottante en bas affiche "Vous votez pour Yao Konan"
9. Clique **Confirmer mon vote**
10. ✅ Modale de confirmation avec animation de scellement (signing → mining)
11. Clique **Confirmer mon vote** dans la modale
12. ✅ Animation "Signature cryptographique du bulletin…" puis "Scellement on-chain en cours…"
13. ✅ Redirection vers `/elections/:id/receipt`

### 2.5 Reçu de vote

1. ✅ Coche verte animée
2. ✅ "Votre vote a été enregistré." + nom de Yao en gras
3. ✅ Carte "Reçu de transaction" avec :
   - Hash de vote (long, copiable via le bouton)
   - Hash transaction : "— hors chaîne —" (normal, Hardhat pas activé)
   - Bloc : "—"
   - Horodatage UTC
4. Clique sur le bouton **Copier** du hash
5. ✅ L'icône change en check
6. Clique **Télécharger PDF**
7. ✅ Un PDF se télécharge avec le bandeau navy + tous les détails du reçu
8. Clique **Voir les résultats en direct**

### 2.6 Résultats temps réel

1. ✅ Cercle de participation (1 / 5 votants — 20%)
2. ✅ Barre de Yao Konan à 100% animée
3. ✅ Sparklines + "Flux on-chain"

### 2.7 Vérification de vote

1. Va sur http://localhost:5173/verify (ou clique "Vérifier un vote" dans le header)
2. Colle le hash du reçu (que tu avais copié)
3. Clique **Vérifier**
4. ✅ Carte verte "Vote authentique" + titre élection + horodatage
5. ✅ Le nom du votant n'apparaît PAS (anonymat préservé)
6. Teste avec un hash bidon `0xdeadbeef` → ✅ Carte rouge "Hash introuvable"

### 2.8 Tentative de double vote

1. Retourne sur http://localhost:5173 (dashboard)
2. ✅ La carte affiche "Vous avez voté" + bouton "Voir les résultats"
3. Va manuellement sur `/elections/:id/vote` (l'ID est dans l'URL des résultats)
4. Sélectionne un autre candidat, confirme
5. ✅ Toast d'erreur rouge "Vous avez déjà voté pour cette élection"

---

## 3. Test du flow admin

### 3.1 Login super-admin

1. Déconnecte-toi (icône en haut à droite)
2. Login : `SUPERADMIN` / `admin12345`
3. ✅ Redirection vers `/admin`
4. ✅ Sidebar navy à gauche avec navigation Tableau de bord / Élections / Étudiants

### 3.2 Dashboard admin

1. ✅ 4 KPI cards (Élections actives, Votes total = 1, Étudiants, Classes)
2. ✅ Tableau "Participation par classe"

### 3.3 Créer une nouvelle élection

1. Clique **Nouvelle élection**
2. Remplis :
   - Titre : `Chef de classe — L3 Cybersécurité`
   - Description : `Test`
   - Classe : L3 Cybersécurité
   - Dates : laisse les défauts
3. Clique **Créer l'élection**
4. ✅ Redirection vers `/admin/elections/<id>`
5. ✅ Bandeau avec badge "Brouillon"
6. ✅ "Aucun candidat enregistré"

### 3.4 Tenter d'ouvrir l'élection sans candidats

1. Clique **Ouvrir le scrutin**
2. ✅ Toast d'erreur "Ajoutez au moins 2 candidats avant d'ouvrir le scrutin"

### 3.5 Créer des étudiants pour cette classe

1. Va dans **Étudiants**
2. Clique **Inscrire un étudiant**
3. Remplis : prénom `Test`, nom `Cyber`, matricule `20240999`, email `test@cyber.ci`, classe L3 Cybersécurité
4. Clique **Inscrire**
5. ✅ L'étudiant apparaît dans la liste
6. Recommence avec un 2e étudiant `20240998`

### 3.6 Ajouter des candidats

1. Retourne sur `/admin/elections` → clique l'élection Cybersécurité
2. Clique **Ajouter un candidat**
3. Sélectionne un des 2 étudiants créés, ajoute un slogan
4. Clique **Ajouter**
5. ✅ Le candidat apparaît dans la grille
6. Recommence pour le 2e étudiant

### 3.7 Modifier l'élection

1. Clique **Modifier** dans le bandeau
2. Change le titre, sauvegarde
3. ✅ Toast "Élection mise à jour" + le titre est à jour

### 3.8 Ouvrir le scrutin

1. Clique **Ouvrir le scrutin**
2. ✅ Toast vert "Scrutin ouvert — scellement on-chain en cours"
3. ✅ Le bandeau passe à "Ouvert" avec point vert pulsant
4. ✅ Le bouton change en "Clôturer le scrutin"
5. ✅ Les boutons Modifier/Supprimer disparaissent

### 3.9 Tentative de suppression d'une élection ouverte

1. (Pas de bouton Supprimer en mode `open` — ✅ déjà bloqué côté UI)
2. Mais via API directement (Swagger `/docs` → DELETE /api/elections/{id})
3. ✅ Réponse 409 "Impossible de supprimer une élection ouverte"

### 3.10 Clôturer + supprimer

1. Clique **Clôturer le scrutin**
2. ✅ Statut → "Fermé"
3. ✅ Bouton **Supprimer définitivement** apparaît
4. Clique-le, confirme
5. ✅ Redirection vers liste, élection disparue

---

## 4. Tests automatisés

```bash
docker compose exec backend pytest -v
```

Tu dois voir **14 tests** passer dans `test_vote_service.py`.

---

## 5. Test API directement (Swagger)

Va sur http://localhost:8000/docs

1. Déplie `/api/auth/login`, clique **Try it out**
2. `username: SUPERADMIN`, `password: admin12345`
3. Copie le `access_token` de la réponse
4. Clique **Authorize** en haut à droite, colle `Bearer <token>`
5. Teste `/api/admin/dashboard` → ✅ 200 avec les KPIs
6. Teste `/api/elections/` → ✅ liste des élections

---

## 6. Reset de la stack

Si tu veux repartir de zéro :

```bash
docker compose down -v        # supprime aussi le volume Postgres
docker compose up --build
```

---

## 7. Activer les fonctionnalités optionnelles

### Email réel (Mailtrap pour le dev)
Crée un compte sur https://mailtrap.io, récupère SMTP, ajoute dans `docker-compose.yml` :
```yaml
backend:
  environment:
    MAIL_USERNAME: <user>
    MAIL_PASSWORD: <pwd>
    MAIL_SERVER: sandbox.smtp.mailtrap.io
    MAIL_PORT: "2525"
```

### Realtime via Supabase
Crée un projet sur https://supabase.com, exécute la migration `supabase/migrations/0001_initial_schema.sql`, puis :
```yaml
frontend:
  environment:
    VITE_SUPABASE_URL: https://<projet>.supabase.co
    VITE_SUPABASE_ANON_KEY: <anon_key>
```

### Blockchain Sepolia
Configure Hardhat localement (voir `contracts/README` à venir), récupère l'adresse du contrat déployé :
```yaml
backend:
  environment:
    WEB3_RPC_URL: https://eth-sepolia.g.alchemy.com/v2/<key>
    CONTRACT_ADDRESS: 0x...
    ADMIN_PRIVATE_KEY: 0x...
```

---

## Problèmes courants

| Symptôme | Cause | Fix |
|---|---|---|
| `connection refused` sur 5432 | Postgres pas encore prêt | Le healthcheck devrait gérer, sinon `docker compose restart backend` |
| Frontend en blanc | Vite n'a pas trouvé le port | Vérifier `vite.config.ts` (host `0.0.0.0`) et que le port 5173 est libre |
| `Matricule déjà enregistré` au seed | Tables existaient déjà | `docker compose down -v && docker compose up --build` |
| Le PDF ne se télécharge pas | `npm install` pas refait après ajout de jspdf | `docker compose build frontend` |
| HMR ne reload pas | Volume Windows mal monté | Le `usePolling: true` dans vite.config.ts est censé régler ça |
