-- =============================================================
--  Guests: new badge + mark seen
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.profiles
  add column if not exists guests_seen_at timestamptz;

create or replace function public.mark_guests_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
  set guests_seen_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.count_new_guests()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  seen_at timestamptz;
  n integer := 0;
begin
  if me is null then
    return 0;
  end if;

  select guests_seen_at into seen_at
  from public.profiles
  where id = me;

  select count(*)::integer into n
  from public.profile_visits
  where profile_id = me
    and visited_at >= now() - interval '24 hours'
    and (
      seen_at is null
      or visited_at > seen_at
    );

  return coalesce(n, 0);
end;
$$;

grant execute on function public.mark_guests_seen() to authenticated;
grant execute on function public.count_new_guests() to authenticated;
