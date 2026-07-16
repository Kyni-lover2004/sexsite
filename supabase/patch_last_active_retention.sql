-- =============================================================
--  last_active_at — internal activity (retention / 30-day cleanup)
--  last_seen       — public "online" indicator only
--
--  Invisible mode freezes last_seen so others don't see you online,
--  but last_active_at keeps updating while the user uses the app.
--  Re-run safe.
-- =============================================================

set lock_timeout = '8s';
set statement_timeout = '60s';

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Backfill once for existing rows
update public.profiles
set last_active_at = coalesce(last_active_at, last_seen, created_at, now())
where last_active_at is null;

alter table public.profiles
  alter column last_active_at set default now();

-- Not null after backfill (safe if column already non-null)
do $$
begin
  alter table public.profiles
    alter column last_active_at set not null;
exception
  when others then null;
end;
$$;

create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at);

-- Heartbeat: always refresh last_active_at; last_seen only when visible.
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

  -- Privilege lapsed while still flagged invisible: clear flag.
  if v_invisible and not v_can_hide then
    update public.profiles
    set is_invisible = false,
        last_seen = ts,
        last_active_at = ts
    where id = me;
    return ts;
  end if;

  -- Invisible (and still allowed): hide public presence, keep retention clock.
  if v_invisible and v_can_hide then
    update public.profiles
    set last_active_at = ts
    where id = me
      and (last_active_at is null or last_active_at < ts - interval '90 seconds');
    return ts;
  end if;

  -- Visible: both public last_seen and internal activity.
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

  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;

-- 30-day inactivity cleanup uses last_active_at (not public last_seen).
-- Admins are never deleted. Call from pg_cron daily.
create or replace function public.delete_inactive_profiles(
  p_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_days is null or p_days < 1 then
    p_days := 30;
  end if;

  with doomed as (
    select id
    from public.profiles
    where coalesce(role, 'user') is distinct from 'admin'
      and coalesce(last_active_at, last_seen, created_at) < (now() - make_interval(days => p_days))
  ),
  del as (
    delete from public.profiles p
    using doomed d
    where p.id = d.id
    returning p.id
  )
  select count(*)::integer into n from del;

  return coalesce(n, 0);
end;
$$;

-- Optional: re-bind cron to the new function (ignore errors if pg_cron missing).
-- Use distinct $tag$ delimiters — nested $$ inside do $$ breaks parsing.
do $cron_setup$
begin
  -- Remove common old job names if present (no-op if absent)
  begin
    perform cron.unschedule('delete-inactive-users');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('cleanup-inactive-profiles');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('delete_inactive_profiles');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('delete-inactive-profiles');
  exception when others then null;
  end;

  perform cron.schedule(
    'delete-inactive-profiles',
    '0 3 * * *',
    $job$select public.delete_inactive_profiles(30);$job$
  );
exception
  when undefined_table then null;   -- cron schema missing
  when undefined_function then null;
  when others then null;
end;
$cron_setup$;

set lock_timeout = 0;
set statement_timeout = 0;
