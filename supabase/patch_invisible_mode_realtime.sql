-- =============================================================
--  OPTIONAL: enable Realtime for profiles (invisible / last_seen)
--  Run alone, not with other DDL, when traffic is low.
--  App works without this via polling (~12s).
-- =============================================================

set lock_timeout = '15s';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$$;
