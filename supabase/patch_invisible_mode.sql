-- =============================================================
--  Invisible mode (premium + admin)
--  When enabled: no last_seen heartbeat, not listed as online,
--  presence/last-seen hidden from others in the app.
--
--  Re-run safe. Prefer running when app traffic is low.
--  Realtime for profiles is OPTIONAL — see bottom comments
--  (do NOT run ALTER PUBLICATION in the same batch under load).
-- =============================================================

-- Fail fast on lock waits instead of hanging / deadlocking forever.
set lock_timeout = '8s';
set statement_timeout = '60s';

-- 1) Column (no-op if already present)
alter table public.profiles
  add column if not exists is_invisible boolean not null default false;

-- 2) Index (skip if exists). Regular create — CONCURRENTLY cannot run
--    inside the SQL editor's implicit transaction.
create index if not exists profiles_is_invisible_idx
  on public.profiles (is_invisible)
  where is_invisible = true;

-- 3) Functions first (replace body without dropping table locks long)
create or replace function public.enforce_invisible_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_invisible, false) then
    if new.role is distinct from 'admin'
       and (new.premium_until is null or new.premium_until <= now()) then
      new.is_invisible := false;
    end if;
  end if;

  -- Instant offline for observers (online window ~2 min client-side).
  -- Only on UPDATE false→true; INSERT has no OLD.
  if tg_op = 'UPDATE'
     and coalesce(new.is_invisible, false)
     and not coalesce(old.is_invisible, false) then
    new.last_seen := now() - interval '3 minutes';
  end if;

  return new;
end;
$$;

-- Prefer full heartbeat from patch_last_active_retention.sql (last_active_at).
-- This fallback keeps invisible last_seen frozen but still bumps last_active_at
-- when that column already exists.
create or replace function public.heartbeat()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ts timestamptz := now();
  v_invisible boolean;
  v_role text;
  v_premium timestamptz;
  v_can_hide boolean;
  has_last_active boolean;
begin
  if me is null then
    return null;
  end if;

  select coalesce(is_invisible, false), role, premium_until
    into v_invisible, v_role, v_premium
  from public.profiles
  where id = me;

  if not found then
    return null;
  end if;

  v_can_hide :=
    v_role = 'admin'
    or (v_premium is not null and v_premium > now());

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'last_active_at'
  ) into has_last_active;

  -- Privilege lapsed while still flagged invisible: clear flag + resume presence.
  if v_invisible and not v_can_hide then
    if has_last_active then
      update public.profiles
      set is_invisible = false,
          last_seen = ts,
          last_active_at = ts
      where id = me;
    else
      update public.profiles
      set is_invisible = false,
          last_seen = ts
      where id = me;
    end if;
    return ts;
  end if;

  -- Invisible + still premium/admin → freeze public last_seen, keep activity.
  if v_invisible and v_can_hide then
    if has_last_active then
      update public.profiles
      set last_active_at = ts
      where id = me
        and (last_active_at is null or last_active_at < ts - interval '90 seconds');
    end if;
    return ts;
  end if;

  if has_last_active then
    update public.profiles
    set last_seen = ts,
        last_active_at = ts
    where id = me
      and (
        last_seen is null
        or last_seen < ts - interval '90 seconds'
        or last_active_at is null
        or last_active_at < ts - interval '90 seconds'
      );
  else
    update public.profiles
    set last_seen = ts
    where id = me
      and (last_seen is null or last_seen < ts - interval '90 seconds');
  end if;

  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;

-- 4) Trigger last (brief exclusive lock on profiles)
drop trigger if exists trg_enforce_invisible_privilege on public.profiles;
create trigger trg_enforce_invisible_privilege
  before insert or update of is_invisible, premium_until, role
  on public.profiles
  for each row
  execute function public.enforce_invisible_privilege();

-- Reset timeouts for the rest of the session (dashboard may keep connection)
set lock_timeout = 0;
set statement_timeout = 0;

-- =============================================================
-- OPTIONAL realtime (run SEPARATELY, only if needed):
-- App already polls every ~12s without this.
--
-- In Dashboard → Database → Publications → supabase_realtime
-- enable "profiles", OR run alone when traffic is quiet:
--
--   alter publication supabase_realtime add table public.profiles;
--
-- If already added: ERROR 42710 / duplicate_object — ignore.
-- =============================================================
