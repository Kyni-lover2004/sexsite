-- Admins can run several active topics at once (news / promo alongside
-- discussions), as documented in README. The old partial unique index
-- topics_one_active_per_author blocked EVERY author, admins included.
-- Replace it with a trigger guard that skips admin authors and keeps
-- the one-active-topic rule for regular users.
-- Supabase → SQL Editor → Run this patch. Safe to re-run (idempotent).

drop index if exists public.topics_one_active_per_author;

create or replace function public.guard_one_active_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and coalesce(
       (select role from public.profiles where id = new.author_id), ''
     ) <> 'admin'
     and exists (
       select 1 from public.topics t
       where t.author_id = new.author_id
         and t.status = 'active'
         and t.id <> new.id
     )
  then
    raise exception 'one_active_topic_per_author';
  end if;
  return new;
end;
$$;

drop trigger if exists topics_one_active_guard on public.topics;
create trigger topics_one_active_guard
  before insert or update of status on public.topics
  for each row execute function public.guard_one_active_topic();
