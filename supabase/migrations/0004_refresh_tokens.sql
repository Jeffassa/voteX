-- ESATIC SmartVote — refresh tokens persistés (rotation + revocation list)

create table if not exists refresh_tokens (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references students(id) on delete cascade,
    jti varchar(64) unique not null,
    token_hash varchar(128) unique not null,
    user_agent varchar(255),
    ip_address varchar(64),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    replaced_by_jti varchar(64)
);

create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_jti on refresh_tokens(jti);
create index if not exists idx_refresh_tokens_hash on refresh_tokens(token_hash);
create index if not exists idx_refresh_tokens_active
    on refresh_tokens(user_id, revoked_at)
    where revoked_at is null;

alter table refresh_tokens disable row level security;

-- Job de purge (à appeler périodiquement, ex: cron Supabase)
create or replace function purge_expired_refresh_tokens()
returns integer
language plpgsql
as $$
declare deleted integer;
begin
    delete from refresh_tokens
        where expires_at < now() - interval '7 days'
           or (revoked_at is not null and revoked_at < now() - interval '30 days')
        returning 1 into deleted;
    return deleted;
end $$;
