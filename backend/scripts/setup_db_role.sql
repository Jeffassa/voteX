-- ============================================================================
-- ESATIC SmartVote — Script de provisionnement du rôle PostgreSQL
-- Principe du Moindre Privilège (Least Privilege)
--
-- USAGE :
--   1. Connectez-vous en tant que superuser (postgres) :
--      psql -U postgres -d smartvote_db -f setup_db_role.sql
--
--   2. Mettez à jour DATABASE_URL dans .env :
--      postgresql://smartvote_app:[MOT_DE_PASSE]@localhost:5432/smartvote_db
--
-- PRINCIPES :
--   - L'utilisateur applicatif ne peut que lire et écrire des données.
--   - Il ne peut PAS créer, modifier ou supprimer des tables (DDL).
--   - Seul l'utilisateur de migration (ou un superuser) peut exécuter Alembic.
-- ============================================================================

-- 1. Création de la base de données (ignorer si déjà existante)
SELECT 'CREATE DATABASE smartvote_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'smartvote_db')\gexec

\connect smartvote_db

-- 2. Création du rôle applicatif avec mot de passe fort
--    ⚠️  REMPLACEZ 'CHANGE_ME_STRONG_PASSWORD' par un secret généré avec :
--    openssl rand -base64 32
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'smartvote_app') THEN
        CREATE ROLE smartvote_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
    END IF;
END
$$;

-- 3. Droits minimaux sur le schéma public
--    Le rôle peut utiliser le schéma public mais ne peut pas créer d'objets.
GRANT USAGE ON SCHEMA public TO smartvote_app;

-- 4. Droits DML uniquement (SELECT, INSERT, UPDATE, DELETE)
--    Aucun droit DDL (CREATE TABLE, ALTER TABLE, DROP TABLE).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartvote_app;

-- 5. Droits sur les séquences (nécessaire pour les colonnes SERIAL / UUID default)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartvote_app;

-- 6. Appliquer les mêmes droits aux nouvelles tables créées par Alembic
--    (les migrations doivent être exécutées par un utilisateur owner, pas smartvote_app)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smartvote_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO smartvote_app;

-- 7. Révocation explicite des droits dangereux (sécurité défensive)
REVOKE CREATE ON SCHEMA public FROM smartvote_app;
REVOKE TEMPORARY ON DATABASE smartvote_db FROM smartvote_app;

-- 8. Création d'un rôle de migration séparé (pour Alembic en CI/CD uniquement)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'smartvote_migration') THEN
        CREATE ROLE smartvote_migration WITH LOGIN PASSWORD 'CHANGE_ME_MIGRATION_PASSWORD';
    END IF;
END
$$;
GRANT ALL PRIVILEGES ON DATABASE smartvote_db TO smartvote_migration;
GRANT ALL PRIVILEGES ON SCHEMA public TO smartvote_migration;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartvote_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartvote_migration;

-- ============================================================================
-- Vérification finale
-- ============================================================================
\echo ''
\echo '=== Droits accordés au rôle smartvote_app ==='
\dp

\echo ''
\echo '=== Rôles créés ==='
\du smartvote_app smartvote_migration
