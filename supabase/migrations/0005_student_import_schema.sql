-- ESATIC SmartVote — schéma pour l'import en masse + comptes pré-importés
--
-- Changements :
-- 1. password_hash devient nullable (compte importé sans mdp = en attente d'activation)
-- 2. email devient nullable (le format Excel ESATIC ne contient pas d'email)
-- 3. ajout d'un type enum gender + colonne gender

-- 1. Type enum gender
do $$ begin
    create type gender as enum ('M', 'F', 'X');
exception when duplicate_object then null; end $$;

-- 2. password_hash nullable
alter table students alter column password_hash drop not null;

-- 3. email nullable (l'unique constraint accepte naturellement les nulls multiples sur Postgres)
alter table students alter column email drop not null;

-- 4. ajout colonne gender
alter table students add column if not exists gender gender;
