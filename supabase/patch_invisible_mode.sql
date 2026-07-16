-- =============================================================
--  Invisible mode (premium + admin)
--  When enabled: no last_seen heartbeat, not listed as online,
--  presence/last-seen hidden from others in the app.
-- =============================================================

alter table public.profiles
  add column if not exists is_invisible boolean not null default false;

create index if not exists profiles_is_invisible_idx
  on public.profiles (is_invisible)
  where is_invisible = true;

-- Only premium (active) or admin may keep is_invisible = true.
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
  return new;
end;
$$;

drop trigger if exists trg_enforce_invisible_privilege on public.profiles;
create trigger trg_enforce_invisible_privilege
  before insert or update of is_invisible, premium_until, role
  on public.profiles
  for each row
  execute function public.enforce_invisible_privilege();

-- Heartbeat skips last_seen while invisible (and still privileged).
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

  -- Invisible + still premium/admin → do not refresh last_seen.
  if v_invisible
     and (
       v_role = 'admin'
       or (v_premium is not null and v_premium > now())
     ) then
    return null;
  end if;

  -- Privilege lapsed while still flagged invisible: clear flag + resume presence.
  if v_invisible then
    update public.profiles
    set is_invisible = false,
        last_seen = ts
    where id = me;
    return ts;
  end if;

  update public.profiles
  set last_seen = ts
  where id = me
    and (last_seen is null or last_seen < ts - interval '90 seconds');

  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;
