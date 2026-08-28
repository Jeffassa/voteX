-- ESATIC SmartVote — table d'audit (append-only)
-- À exécuter après 0001_initial_schema.sql

do $$ begin
    create type audit_action as enum (
        'login', 'logout',
        'password_changed', 'password_reset_requested', 'password_reset_confirmed',
        'election_created', 'election_updated', 'election_deleted',
        'election_opened', 'election_closed',
        'candidate_created', 'candidate_deleted',
        'student_created', 'student_updated', 'student_deleted', 'student_role_changed',
        'class_created', 'class_updated', 'class_deleted',
        'vote_cast'
    );
exception when duplicate_object then null; end $$;

create table if not exists audit_events (
    id uuid primary key default uuid_generate_v4(),
    actor_id uuid references students(id) on delete set null,
    action audit_action not null,
    target_type varchar(50),
    target_id varchar(64),
    details text,
    ip_address varchar(64),
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_actor on audit_events(actor_id);
create index if not exists idx_audit_action on audit_events(action);
create index if not exists idx_audit_target on audit_events(target_id);
create index if not exists idx_audit_created on audit_events(created_at desc);

-- Empêcher les UPDATE/DELETE — append-only
create or replace function audit_events_no_modify() returns trigger as $$
begin
    raise exception 'audit_events est append-only, % interdit', tg_op;
end $$ language plpgsql;

drop trigger if exists trg_audit_no_update on audit_events;
create trigger trg_audit_no_update before update on audit_events
    for each row execute function audit_events_no_modify();

drop trigger if exists trg_audit_no_delete on audit_events;
create trigger trg_audit_no_delete before delete on audit_events
    for each row execute function audit_events_no_modify();

alter table audit_events disable row level security;
