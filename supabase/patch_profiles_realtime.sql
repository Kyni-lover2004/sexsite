-- =============================================================
--  Enable Realtime postgres_changes for profiles
--  (last_seen / is_invisible for open chats)
--
--  Instant online ALSO works via Broadcast (no SQL needed).
--  This patch is optional extra for DB-level updates.
--  Run alone when traffic is low.
-- =============================================================

set lock_timeout = '15s';

-- Primary key filters work with default replica identity;
-- FULL helps if you add more filter columns later.
do $body$
begin
  begin
    execute 'alter table public.profiles replica identity full';
  exception
    when others then null;
  end;

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
$body$;

set lock_timeout = 0;
