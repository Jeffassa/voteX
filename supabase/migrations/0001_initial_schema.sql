-- ESATIC SmartVote — schéma initial
-- À exécuter dans le SQL Editor de Supabase

create extension if not exists "uuid-ossp";

-- Enums
do $$ begin
    create type user_role as enum ('student', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
    create type election_status as enum ('draft', 'open', 'closed', 'published');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists classes (
    id uuid primary key default uuid_generate_v4(),
    name varchar(50) not null,
    level varchar(20) not null,
    field varchar(100) not null,
    created_at timestamptz not null default now()
);

create table if not exists students (
    id uuid primary key default uuid_generate_v4(),
    matricule varchar(20) unique not null,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    email varchar(255) unique not null,
    password_hash varchar(255) not null,
    role user_role not null default 'student',
    photo_url varchar(500),
    is_active boolean not null default true,
    class_id uuid references classes(id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists idx_students_matricule on students(matricule);
create index if not exists idx_students_class on students(class_id);

create table if not exists elections (
    id uuid primary key default uuid_generate_v4(),
    title varchar(200) not null,
    description text,
    class_id uuid not null references classes(id) on delete cascade,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status election_status not null default 'draft',
    blockchain_id integer,
    created_at timestamptz not null default now(),
    constraint valid_period check (ends_at > starts_at)
);
create index if not exists idx_elections_class on elections(class_id);
create index if not exists idx_elections_status on elections(status);

create table if not exists candidates (
    id uuid primary key default uuid_generate_v4(),
    election_id uuid not null references elections(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    slogan varchar(200),
    program text,
    biography text,
    photo_url varchar(500),
    blockchain_id integer,
    created_at timestamptz not null default now(),
    unique (election_id, student_id)
);
create index if not exists idx_candidates_election on candidates(election_id);

create table if not exists votes (
    id uuid primary key default uuid_generate_v4(),
    election_id uuid not null references elections(id) on delete cascade,
    candidate_id uuid not null references candidates(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    vote_hash varchar(66) unique not null,
    tx_hash varchar(66),
    block_number integer,
    created_at timestamptz not null default now(),
    unique (election_id, student_id)
);
create index if not exists idx_votes_election on votes(election_id);
create index if not exists idx_votes_candidate on votes(candidate_id);
create index if not exists idx_votes_hash on votes(vote_hash);

-- Activer Realtime sur la table votes (pour résultats live)
alter publication supabase_realtime add table votes;

-- Vue pratique pour résultats temps réel
create or replace view election_results as
select
    e.id as election_id,
    e.title,
    e.status,
    c.id as candidate_id,
    s.first_name || ' ' || s.last_name as candidate_name,
    s.photo_url,
    count(v.id) as vote_count
from elections e
join candidates c on c.election_id = e.id
join students s on s.id = c.student_id
left join votes v on v.candidate_id = c.id
group by e.id, c.id, s.id;

-- RLS — politique conservatrice : on désactive RLS pour le MVP, le backend FastAPI
-- gère les autorisations via JWT. À durcir si on expose l'API anon directement.
alter table classes disable row level security;
alter table students disable row level security;
alter table elections disable row level security;
alter table candidates disable row level security;
alter table votes disable row level security;

-- Données de démo (classes ESATIC)
insert into classes (name, level, field) values
    ('Génie Logiciel', 'L3', 'Génie Logiciel'),
    ('Réseaux Télécoms', 'L3', 'Réseaux Télécoms'),
    ('Cybersécurité', 'L3', 'Cybersécurité'),
    ('Intelligence Artificielle', 'L3', 'Intelligence Artificielle')
on conflict do nothing;
