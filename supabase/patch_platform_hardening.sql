-- =============================================================
--  Platform hardening: photo views, rate limits, analytics,
--  presence heartbeat, private albums flag
--  Supabase → SQL Editor → Run
-- =============================================================

-- ---------- Photo view limits (free viewers, per target profile) ----------
create table if not exists public.gallery_photo_views (
  viewer_id   uuid not null references public.profiles (id) on delete cascade,
  photo_id    uuid not null references public.profile_photos (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (viewer_id, photo_id)
);
create index if not exists gallery_photo_views_viewer_profile_idx
  on public.gallery_photo_views (viewer_id, profile_id);

alter table public.gallery_photo_views enable row level security;

drop policy if exists gallery_photo_views_select on public.gallery_photo_views;
create policy gallery_photo_views_select on public.gallery_photo_views
  for select using (auth.uid() = viewer_id);

drop policy if exists gallery_photo_views_insert on public.gallery_photo_views;
create policy gallery_photo_views_insert on public.gallery_photo_views
  for insert with check (auth.uid() = viewer_id);

-- Free: 10 unique photos per target profile. Premium viewer: unlimited.
-- Owner always unlimited (handled client-side / not called).
create or replace function public.record_gallery_photo_view(
  p_photo_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_premium timestamptz;
  v_count integer;
  v_limit constant integer := 10;
  v_exists boolean;
begin
  if me is null or p_photo_id is null or p_profile_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;
  if me = p_profile_id then
    return jsonb_build_object('allowed', true, 'count', 0, 'limit', null, 'premium', true);
  end if;

  select premium_until into v_premium from public.profiles where id = me;
  if v_premium is not null and v_premium > now() then
    return jsonb_build_object('allowed', true, 'count', 0, 'limit', null, 'premium', true);
  end if;

  select exists(
    select 1 from public.gallery_photo_views
    where viewer_id = me and photo_id = p_photo_id
  ) into v_exists;

  if v_exists then
    select count(*)::integer into v_count
    from public.gallery_photo_views
    where viewer_id = me and profile_id = p_profile_id;
    return jsonb_build_object('allowed', true, 'count', v_count, 'limit', v_limit, 'premium', false);
  end if;

  select count(*)::integer into v_count
  from public.gallery_photo_views
  where viewer_id = me and profile_id = p_profile_id;

  if v_count >= v_limit then
    return jsonb_build_object('allowed', false, 'count', v_count, 'limit', v_limit, 'premium', false);
  end if;

  insert into public.gallery_photo_views (viewer_id, photo_id, profile_id)
  values (me, p_photo_id, p_profile_id)
  on conflict do nothing;

  select count(*)::integer into v_count
  from public.gallery_photo_views
  where viewer_id = me and profile_id = p_profile_id;

  return jsonb_build_object('allowed', true, 'count', v_count, 'limit', v_limit, 'premium', false);
end;
$$;

create or replace function public.count_gallery_photo_views(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_premium timestamptz;
  v_count integer;
  v_limit constant integer := 10;
begin
  if me is null then
    return jsonb_build_object('count', 0, 'limit', v_limit, 'premium', false);
  end if;
  if me = p_profile_id then
    return jsonb_build_object('count', 0, 'limit', null, 'premium', true);
  end if;
  select premium_until into v_premium from public.profiles where id = me;
  if v_premium is not null and v_premium > now() then
    return jsonb_build_object('count', 0, 'limit', null, 'premium', true);
  end if;
  select count(*)::integer into v_count
  from public.gallery_photo_views
  where viewer_id = me and profile_id = p_profile_id;
  return jsonb_build_object('count', coalesce(v_count, 0), 'limit', v_limit, 'premium', false);
end;
$$;

grant execute on function public.record_gallery_photo_view(uuid, uuid) to authenticated;
grant execute on function public.count_gallery_photo_views(uuid) to authenticated;

-- ---------- Rate limits (generic sliding window counters) ----------
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hit_count integer not null default 0
);

alter table public.rate_limits enable row level security;
-- no client policies — only SECURITY DEFINER functions

create or replace function public.check_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k text;
  rec public.rate_limits%rowtype;
  win interval;
begin
  if me is null then
    return false;
  end if;
  k := p_bucket || ':' || me::text;
  win := make_interval(secs => greatest(p_window_seconds, 1));

  select * into rec from public.rate_limits where key = k for update;
  if not found then
    insert into public.rate_limits (key, window_start, hit_count)
    values (k, now(), 1);
    return true;
  end if;

  if rec.window_start < now() - win then
    update public.rate_limits
    set window_start = now(), hit_count = 1
    where key = k;
    return true;
  end if;

  if rec.hit_count >= p_max then
    return false;
  end if;

  update public.rate_limits
  set hit_count = hit_count + 1
  where key = k;
  return true;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

-- Messages: max 40 / minute
create or replace function public.trg_rate_limit_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rate_limit('msg', 40, 60) then
    raise exception 'RATE_LIMIT_MESSAGES' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rate_limit_messages on public.messages;
create trigger trg_rate_limit_messages
  before insert on public.messages
  for each row execute function public.trg_rate_limit_messages();

-- Friend requests: max 30 / day
create or replace function public.trg_rate_limit_friendships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    if not public.check_rate_limit('friend_req', 30, 86400) then
      raise exception 'RATE_LIMIT_FRIENDS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rate_limit_friendships on public.friendships;
create trigger trg_rate_limit_friendships
  before insert on public.friendships
  for each row execute function public.trg_rate_limit_friendships();

-- Profile likes: max 80 / day
create or replace function public.trg_rate_limit_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rate_limit('like', 80, 86400) then
    raise exception 'RATE_LIMIT_LIKES' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profile_likes') is not null then
    drop trigger if exists trg_rate_limit_likes on public.profile_likes;
    create trigger trg_rate_limit_likes
      before insert on public.profile_likes
      for each row execute function public.trg_rate_limit_likes();
  end if;
end $$;

-- ---------- Presence heartbeat (avoids thrash writes) ----------
create or replace function public.heartbeat()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ts timestamptz := now();
begin
  if me is null then
    return null;
  end if;
  update public.profiles
  set last_seen = ts
  where id = me
    and (last_seen is null or last_seen < ts - interval '90 seconds');
  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;

-- ---------- Private albums flag ----------
alter table public.profile_albums
  add column if not exists is_private boolean not null default false;

-- Private photos still in public bucket for now; signed URLs used when is_private.
-- Optional private bucket (safe if already exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos-private',
  'profile-photos-private',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Private profile photo read" on storage.objects;
create policy "Private profile photo read" on storage.objects
  for select using (
    bucket_id = 'profile-photos-private'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Private profile photo write" on storage.objects;
create policy "Private profile photo write" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos-private'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Private profile photo delete" on storage.objects;
create policy "Private profile photo delete" on storage.objects
  for delete using (
    bucket_id = 'profile-photos-private'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------- Analytics funnel ----------
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_event_idx
  on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert on public.analytics_events
  for insert with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

-- Users cannot read raw analytics; admins can
drop policy if exists analytics_events_select on public.analytics_events;
create policy analytics_events_select on public.analytics_events
  for select using (public.is_admin());

create or replace function public.track_event(p_event text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_event is null or length(p_event) < 2 then
    return;
  end if;
  insert into public.analytics_events (user_id, event, props)
  values (auth.uid(), left(p_event, 80), coalesce(p_props, '{}'::jsonb));
end;
$$;

grant execute on function public.track_event(text, jsonb) to authenticated;
