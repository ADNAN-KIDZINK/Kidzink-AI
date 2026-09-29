-- Kidzink AI: staff entitlements and issued OpenRouter keys, in the SHARED Kidzink project
-- (hxpabclqbqrukmfqdahz). Additive only: a new `kidzink_ai` schema; nothing in kidzink_auth,
-- kompass or public is altered. Paste into the SQL editor once, then add `kidzink_ai` under
-- Project Settings -> API -> Exposed schemas.
--
-- Who can do what:
--   model_groups, entitlements  admins (kidzink_auth role 'admin') read/write; staff read their own entitlement
--   issued_keys                 no client access at all; only the kidzink-ai-key Edge Function (service role)

create schema if not exists kidzink_ai;

-- Same live check as kompass.is_admin(): kidzink_auth.user_roles is the single source of truth.
create or replace function kidzink_ai.is_admin()
returns boolean
language sql
stable
security definer
set search_path = kidzink_ai, kidzink_auth, pg_temp
as $$
    select exists (
        select 1 from kidzink_auth.user_roles ur
        join kidzink_auth.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.code = 'admin'
    );
$$;

create or replace function kidzink_ai.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ============================================================================
-- 1. Model groups: which OpenRouter models a group of staff may use.
--    `models` are OpenRouter model ids as the app requests them (e.g. anthropic/claude-sonnet-5).
--    guardrail_id is filled in by the broker when it creates the group's OpenRouter guardrail.
-- ============================================================================
create table if not exists kidzink_ai.model_groups (
    code          text primary key check (code ~ '^[a-z0-9-]+$'),
    name          text not null,
    models        text[] not null check (cardinality(models) > 0),
    default_model text not null,
    guardrail_id  text,
    updated_at    timestamptz not null default now(),
    check (default_model = any (models))
);

-- ============================================================================
-- 2. Entitlements: the staff list. One row per person who may use Kidzink AI.
--    Remove a row or set enabled = false to switch someone off (their key is disabled on
--    their next app start, and by the daily sync at the latest).
-- ============================================================================
create table if not exists kidzink_ai.entitlements (
    email             text primary key check (email = lower(email) and email like '%@%'),
    full_name         text,
    monthly_limit_usd numeric(10, 2) not null check (monthly_limit_usd >= 0),
    model_group       text not null references kidzink_ai.model_groups (code) on update cascade,
    enabled           boolean not null default true,
    notes             text,
    updated_at        timestamptz not null default now()
);

-- ============================================================================
-- 3. Issued keys: one OpenRouter key per person, stored AES-256-GCM encrypted with the
--    KEY_ENCRYPTION_SECRET Edge Function secret (never in the database). key_sha256 lets the
--    app look up its own entitlements without sending the key.
-- ============================================================================
create table if not exists kidzink_ai.issued_keys (
    user_id             uuid primary key references auth.users (id) on delete cascade,
    email               text not null,
    openrouter_key_hash text not null unique,
    key_sha256          text not null unique check (key_sha256 ~ '^[0-9a-f]{64}$'),
    key_ciphertext      text not null,
    key_iv              text not null,
    limit_usd           numeric(10, 2) not null,
    model_group         text not null,
    disabled            boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

drop trigger if exists model_groups_touch on kidzink_ai.model_groups;
create trigger model_groups_touch before update on kidzink_ai.model_groups
    for each row execute function kidzink_ai.touch_updated_at();
drop trigger if exists entitlements_touch on kidzink_ai.entitlements;
create trigger entitlements_touch before update on kidzink_ai.entitlements
    for each row execute function kidzink_ai.touch_updated_at();
drop trigger if exists issued_keys_touch on kidzink_ai.issued_keys;
create trigger issued_keys_touch before update on kidzink_ai.issued_keys
    for each row execute function kidzink_ai.touch_updated_at();

-- ============================================================================
-- 4. Row level security and grants
-- ============================================================================
alter table kidzink_ai.model_groups enable row level security;
alter table kidzink_ai.entitlements enable row level security;
alter table kidzink_ai.issued_keys enable row level security;

drop policy if exists model_groups_admin on kidzink_ai.model_groups;
create policy model_groups_admin on kidzink_ai.model_groups
    for all to authenticated using (kidzink_ai.is_admin()) with check (kidzink_ai.is_admin());

drop policy if exists entitlements_read on kidzink_ai.entitlements;
create policy entitlements_read on kidzink_ai.entitlements
    for select to authenticated
    using (email = lower(auth.jwt() ->> 'email') or kidzink_ai.is_admin());
drop policy if exists entitlements_write on kidzink_ai.entitlements;
create policy entitlements_write on kidzink_ai.entitlements
    for all to authenticated using (kidzink_ai.is_admin()) with check (kidzink_ai.is_admin());

-- issued_keys deliberately has no policies: with RLS on, anon/authenticated see nothing.

grant usage on schema kidzink_ai to authenticated, service_role;
grant select, insert, update, delete on kidzink_ai.model_groups, kidzink_ai.entitlements to authenticated;
grant all on all tables in schema kidzink_ai to service_role;
revoke all on kidzink_ai.issued_keys from anon, authenticated;
grant execute on function kidzink_ai.is_admin() to authenticated;

-- ============================================================================
-- 5. Example rows (edit before running, or add rows later in the Table Editor)
-- ============================================================================
-- insert into kidzink_ai.model_groups (code, name, models, default_model) values
--     ('standard', 'Standard', array['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'], 'anthropic/claude-sonnet-5'),
--     ('power', 'Power users', array['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5', 'anthropic/claude-opus-5.5'], 'anthropic/claude-sonnet-5');
--
-- insert into kidzink_ai.entitlements (email, full_name, monthly_limit_usd, model_group) values
--     ('adnan@kidzink.com', 'Adnan', 20, 'power');
