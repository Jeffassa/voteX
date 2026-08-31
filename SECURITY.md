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
6. **Matricule et nom ne sont pas un secret.** Ils figurent sur toute liste
   d'appel : les présenter ne suffit donc pas à prendre possession d'un compte
   importé. Une revendication n'est immédiate que si l'identité a été confirmée
   par un canal que l'école contrôle — adresse issue du fichier d'import, ou
   code envoyé à une adresse déjà connue d'elle. Sinon, elle attend une décision
   humaine. Un refus **libère** le compte au lieu de le geler, pour que la
   tentative d'un tiers ne prive pas le titulaire de son scrutin. Vérifié par
   `tests/test_account_takeover.py`.
7. **Les essais répétés sont sanctionnés par compte, pas par adresse IP.** Sur
   un campus, une promotion entière sort par la même IP : n'y limiter que le
   débit punirait tout le monde sans gêner un attaquant patient. Le compte visé
   se verrouille par paliers (5 échecs → 1 min, 8 → 5 min, 12 → 30 min) ; la
   limite par IP demeure, mais comme protection de l'infrastructure. Une
   réinitialisation de mot de passe lève le verrou — le message qui la propose
   doit dire vrai.

## Acheminement des emails — à vérifier avant toute campagne

Les codes d'activation, les liens de réinitialisation, les reçus de vote et les
avis d'activation passent tous par SMTP (Resend). **Constaté le 31/08/2026:
aucun de ces messages ne partait.** Le fournisseur refusait la totalité des
envois en `550 — The associated domain with your API key is not verified`,
tandis que l'application se contentait d'une ligne de journal et que
l'interface affichait « Code envoyé ! Vérifie ta boîte mail. »

Deux conditions, dans cet ordre :

1. **Vérifier un domaine chez Resend** (resend.com/domains) et fixer
   `MAIL_FROM=no-reply@<ce domaine>`. Tant que ce n'est pas fait, seule
   l'adresse bac à sable `onboarding@resend.dev` est acceptée, et uniquement
   vers l'adresse du titulaire du compte : aucun étudiant ne recevra rien.
2. **Ne pas laisser un échec passer inaperçu.** Le compteur
   `smartvote_emails_total{outcome="failed"}` et les alertes
   `EmailDeliveryFailing` / `EmailNotConfigured` existent pour cela. Un code
   d'activation qui n'arrive pas ferme l'accès au scrutin aussi sûrement
   qu'une panne de serveur.

Note : `fastapi-mail` ajoute au destinataire un nom d'affichage dérivé de
l'adresse (`nom <nom@exemple.ci>`). En mode bac à sable, Resend refuse cette
forme. Le problème disparaît avec un domaine vérifié.

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
