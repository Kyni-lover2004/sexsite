-- =============================================================
--  People: profile likes / mutual interest
--  Supabase → SQL Editor → Run
-- =============================================================

create table if not exists public.profile_likes (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  constraint profile_likes_not_self check (from_id <> to_id)
);

create index if not exists profile_likes_to_idx
  on public.profile_likes (to_id, created_at desc);
create index if not exists profile_likes_from_idx
  on public.profile_likes (from_id, created_at desc);

alter table public.profile_likes enable row level security;

drop policy if exists profile_likes_select on public.profile_likes;
create policy profile_likes_select on public.profile_likes
  for select using (auth.uid() = from_id or auth.uid() = to_id);

drop policy if exists profile_likes_insert on public.profile_likes;
create policy profile_likes_insert on public.profile_likes
  for insert with check (auth.uid() = from_id);

drop policy if exists profile_likes_delete on public.profile_likes;
create policy profile_likes_delete on public.profile_likes
  for delete using (auth.uid() = from_id);
