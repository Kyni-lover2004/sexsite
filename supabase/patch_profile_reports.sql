-- =============================================================
--  Profile reports + richer content report fields
--  Supabase → SQL Editor → Run
-- =============================================================

-- Optional structured fields on content reports (posts/comments)
alter table public.content_reports
  add column if not exists reason_code text;
alter table public.content_reports
  add column if not exists details text;

-- Profile / user reports
create table if not exists public.profile_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references public.profiles (id) on delete cascade,
  reported_user_id  uuid not null references public.profiles (id) on delete cascade,
  reason_code       text not null,
  reason_label      text not null,
  details           text not null default '',
  status            text not null default 'open'
                      check (status in ('open', 'reviewed', 'dismissed')),
  admin_note        text,
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  constraint profile_reports_not_self check (reporter_id <> reported_user_id),
  constraint profile_reports_reason_len check (
    char_length(reason_label) between 2 and 120
    and char_length(details) <= 800
  )
);

create unique index if not exists profile_reports_once
  on public.profile_reports (reporter_id, reported_user_id)
  where status = 'open';

create index if not exists profile_reports_status_idx
  on public.profile_reports (status, created_at desc);

create index if not exists profile_reports_user_idx
  on public.profile_reports (reported_user_id, created_at desc);

alter table public.profile_reports enable row level security;

drop policy if exists profile_reports_insert on public.profile_reports;
create policy profile_reports_insert on public.profile_reports
  for insert with check (
    auth.uid() = reporter_id
    and reported_user_id <> auth.uid()
  );

drop policy if exists profile_reports_select on public.profile_reports;
create policy profile_reports_select on public.profile_reports
  for select using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists profile_reports_update on public.profile_reports;
create policy profile_reports_update on public.profile_reports
  for update using (public.is_admin());

drop policy if exists profile_reports_delete on public.profile_reports;
create policy profile_reports_delete on public.profile_reports
  for delete using (public.is_admin());
