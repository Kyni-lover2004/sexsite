-- =============================================================
--  Feed: pin topics + content reports
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.topics
  add column if not exists is_pinned boolean not null default false;

create index if not exists topics_pinned_idx
  on public.topics (is_pinned desc, created_at desc)
  where (status = 'active');

create or replace function public.guard_topic_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.is_pinned is distinct from old.is_pinned and not public.is_admin() then
    raise exception 'Only admins can pin topics';
  end if;
  if tg_op = 'INSERT' and new.is_pinned and not public.is_admin() then
    new.is_pinned := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_topic_pin on public.topics;
create trigger trg_guard_topic_pin
  before insert or update of is_pinned on public.topics
  for each row execute function public.guard_topic_pin();

create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 500),
  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'dismissed')),
  created_at   timestamptz not null default now(),
  check (
    (topic_id is not null and comment_id is null)
    or (topic_id is null and comment_id is not null)
  )
);

create unique index if not exists content_reports_topic_once
  on public.content_reports (reporter_id, topic_id)
  where topic_id is not null;
create unique index if not exists content_reports_comment_once
  on public.content_reports (reporter_id, comment_id)
  where comment_id is not null;
create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports
  for select using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists content_reports_update on public.content_reports;
create policy content_reports_update on public.content_reports
  for update using (public.is_admin());
drop policy if exists content_reports_delete on public.content_reports;
create policy content_reports_delete on public.content_reports
  for delete using (public.is_admin());
