# Politique de sécurité — ESATIC SmartVote

## Signaler une vulnérabilité

N'ouvrez **pas** d'issue publique pour une faille de sécurité : le dépôt est
public et une issue rend l'exploitation possible avant le correctif.

- Écrivez à l'équipe projet avec le sujet `[SECURITY] SmartVote`.
- Décrivez le chemin d'exploitation, l'impact et, si possible, une preuve de
  concept minimale.
- Vous recevrez un accusé sous 72 h et un point d'avancement hebdomadaire
  jusqu'à la correction.

Merci de laisser 90 jours avant toute divulgation publique, ou moins si le
correctif est déployé plus tôt.

## Périmètre

Ce dépôt porte trois composants aux surfaces distinctes :

| Composant | Ce qui compte | Ce qui ne compte pas |
|---|---|---|
| `backend/` (FastAPI) | authentification, autorisation, intégrité du scrutin, injection, fuite de données | erreurs 500 sans impact sur les données |
| `frontend/` (React) | XSS, exfiltration de session, altération du bulletin affiché | défauts d'affichage |
| `contracts/` (Solidity) | intégrité des hachages on-chain, contrôle d'accès du contrat | coût en gaz |

Les données de démonstration (`scripts/seed.py`) utilisent des mots de passe
publics **et refusent de s'installer** quand `ENVIRONMENT=production`. Un compte
de démo trouvé sur un déploiement de test n'est pas une vulnérabilité ; le même
compte sur une instance de production en est une — signalez-le.

## Propriétés de sécurité que le code s'engage à tenir

Ces invariants sont testés ; une régression sur l'un d'eux est un bug de
sécurité, pas une évolution.

1. **Secret du vote.** Aucune colonne ne relie un bulletin à son auteur.
   `voter_records` dit *qui a voté*, `votes` dit *ce qui a été voté*, et rien ne
   permet de recoller les deux. Vérifié par `tests/test_schema_migrations.py`.
2. **Unicité du vote.** Un électeur ne peut déposer qu'un bulletin par scrutin,
   garanti par une contrainte d'unicité en base — pas seulement par un contrôle
   applicatif.
3. **Cloisonnement par classe.** Un étudiant ne peut lire que les élections de
   sa promotion. Vérifié par `tests/test_election_access.py`.
4. **Sessions.** Les jetons vivent dans des cookies `httpOnly`; un changement de
   mot de passe invalide cryptographiquement les jetons émis avant lui
   (`password_version`), et la réutilisation d'un refresh token révoque toute la
   chaîne.
5. **Aucun secret de production dans le dépôt.** Le démarrage refuse les secrets
   de développement publiés ici (`app/core/startup_checks.py`).

## Configuration attendue en production

```bash
ENVIRONMENT=production      # active les gardes de démarrage
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=true          # cookies réservés à HTTPS
DATABASE_URL=postgresql://…  # jamais SQLite
METRICS_TOKEN=$(openssl rand -hex 32)   # si METRICS_ENABLED=true
```

Le backend s'arrête au démarrage si l'une de ces conditions n'est pas remplie.

## Dépendances

`npm audit` et `pip-audit` tournent à chaque intégration continue
(`.github/workflows/security.yml`). Dependabot propose les mises à jour de
sécurité hebdomadairement.
