-- Site owner: only this account can demote admins ("Снять админа").
-- Supabase → SQL Editor → Run, then mark yourself:
--
--   update public.profiles
--   set is_owner = true, role = 'admin'
--   where username = 'ВАШ_USERNAME';
--   -- or: where id = 'uuid-из-auth';

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

create index if not exists profiles_is_owner_idx
  on public.profiles (is_owner)
  where is_owner = true;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is_owner changes: only current owner (or SQL session without auth.uid)
  if new.is_owner is distinct from old.is_owner then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can change the owner flag';
    end if;
  end if;

  -- Owner account is protected from demotion / losing owner flag via app
  if old.is_owner then
    if new.is_owner is distinct from true then
      raise exception 'Cannot remove the site owner flag from this account';
    end if;
    if new.role is distinct from 'admin' then
      raise exception 'Cannot demote the site owner';
    end if;
  end if;

  -- Demote admin → user: only site owner
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can remove admin privileges';
    end if;
  end if;

  -- Other protected fields: any admin (or SQL without jwt)
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.is_banned is distinct from old.is_banned
    or new.banned_until is distinct from old.banned_until
    or new.ban_reason is distinct from old.ban_reason
    or new.banned_by is distinct from old.banned_by
    or new.banned_at is distinct from old.banned_at
    or new.premium_until is distinct from old.premium_until then
    raise exception 'Only admins can update moderation and premium fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_admin_fields on public.profiles;
create trigger trg_guard_profile_admin_fields
  before update on public.profiles
  for each row execute function public.guard_profile_admin_fields();
