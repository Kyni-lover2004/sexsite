-- =============================================================
--  Daily quotas: photos, profile opens, swipes
--  free: photos 10/day, profiles 2/day, swipe likes 10/day (pass free)
--  premium: photos 100/day, profiles unlimited, swipe likes 100/day
--  admin: unlimited everywhere
--  Supabase → SQL Editor → Run
-- =============================================================

-- Unique photo opens per UTC day
create table if not exists public.daily_photo_opens (
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  photo_id   uuid not null references public.profile_photos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  opened_at  timestamptz not null default now(),
  primary key (viewer_id, day, photo_id)
);
create index if not exists daily_photo_opens_viewer_day_idx
  on public.daily_photo_opens (viewer_id, day);

alter table public.daily_photo_opens enable row level security;
drop policy if exists daily_photo_opens_select on public.daily_photo_opens;
create policy daily_photo_opens_select on public.daily_photo_opens
  for select using (auth.uid() = viewer_id);

-- Unique profile opens per UTC day (search / foreign profiles)
create table if not exists public.daily_profile_opens (
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  opened_at  timestamptz not null default now(),
  primary key (viewer_id, day, profile_id)
);
create index if not exists daily_profile_opens_viewer_day_idx
  on public.daily_profile_opens (viewer_id, day);

alter table public.daily_profile_opens enable row level security;
drop policy if exists daily_profile_opens_select on public.daily_profile_opens;
create policy daily_profile_opens_select on public.daily_profile_opens
  for select using (auth.uid() = viewer_id);

-- Swipe action counter per UTC day
create table if not exists public.daily_swipe_counts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day     date not null,
  hit_count integer not null default 0,
  primary key (user_id, day)
);

alter table public.daily_swipe_counts enable row level security;
-- no client policies — SECURITY DEFINER only

create or replace function public.quota_utc_day()
returns date
language sql
stable
as $$
  select (timezone('utc', now()))::date;
$$;

-- Returns: free | premium | admin
create or replace function public.viewer_access_tier(p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_premium timestamptz;
begin
  if p_user_id is null then
    return 'free';
  end if;
  select role::text, premium_until into v_role, v_premium
  from public.profiles where id = p_user_id;
  if v_role = 'admin' then
    return 'admin';
  end if;
  if v_premium is not null and v_premium > now() then
    return 'premium';
  end if;
  return 'free';
end;
$$;

grant execute on function public.viewer_access_tier(uuid) to authenticated;

-- Photo daily limit (null = unlimited)
create or replace function public.photo_daily_limit(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'admin' then null
    when 'premium' then 100
    else 10
  end;
$$;

create or replace function public.profile_daily_limit(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'admin' then null
    when 'premium' then null
    else 2
  end;
$$;

create or replace function public.swipe_daily_limit(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'admin' then null
    when 'premium' then 100
    else 10
  end;
$$;

-- ---------- Photos ----------
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
  v_tier text;
  v_limit integer;
  v_day date := public.quota_utc_day();
  v_count integer;
  v_exists boolean;
begin
  if me is null or p_photo_id is null or p_profile_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;

  -- Own profile always free
  if me = p_profile_id then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', null,
      'unlimited', true, 'tier', 'own'
    );
  end if;

  v_tier := public.viewer_access_tier(me);
  v_limit := public.photo_daily_limit(v_tier);

  if v_limit is null then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', null,
      'unlimited', true, 'tier', v_tier
    );
  end if;

  select exists(
    select 1 from public.daily_photo_opens
    where viewer_id = me and day = v_day and photo_id = p_photo_id
  ) into v_exists;

  if v_exists then
    select count(*)::integer into v_count
    from public.daily_photo_opens
    where viewer_id = me and day = v_day;
    return jsonb_build_object(
      'allowed', true, 'count', v_count, 'limit', v_limit,
      'unlimited', false, 'tier', v_tier
    );
  end if;

  select count(*)::integer into v_count
  from public.daily_photo_opens
  where viewer_id = me and day = v_day;

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'limit', v_limit,
      'unlimited', false, 'tier', v_tier, 'reason', 'daily_limit'
    );
  end if;

  insert into public.daily_photo_opens (viewer_id, day, photo_id, profile_id)
  values (me, v_day, p_photo_id, p_profile_id)
  on conflict do nothing;

  -- also keep legacy table warm if present
  begin
    insert into public.gallery_photo_views (viewer_id, photo_id, profile_id)
    values (me, p_photo_id, p_profile_id)
    on conflict do nothing;
  exception when undefined_table then
    null;
  end;

  select count(*)::integer into v_count
  from public.daily_photo_opens
  where viewer_id = me and day = v_day;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'limit', v_limit,
    'unlimited', false, 'tier', v_tier
  );
end;
$$;

create or replace function public.count_gallery_photo_views(p_profile_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_tier text;
  v_limit integer;
  v_day date := public.quota_utc_day();
  v_count integer;
begin
  if me is null then
    return jsonb_build_object('count', 0, 'limit', 10, 'unlimited', false, 'tier', 'free');
  end if;

  if p_profile_id is not null and me = p_profile_id then
    return jsonb_build_object(
      'count', 0, 'limit', null, 'unlimited', true, 'tier', 'own'
    );
  end if;

  v_tier := public.viewer_access_tier(me);
  v_limit := public.photo_daily_limit(v_tier);

  if v_limit is null then
    return jsonb_build_object(
      'count', 0, 'limit', null, 'unlimited', true, 'tier', v_tier
    );
  end if;

  select count(*)::integer into v_count
  from public.daily_photo_opens
  where viewer_id = me and day = v_day;

  return jsonb_build_object(
    'count', coalesce(v_count, 0),
    'limit', v_limit,
    'unlimited', false,
    'tier', v_tier
  );
end;
$$;

grant execute on function public.record_gallery_photo_view(uuid, uuid) to authenticated;
grant execute on function public.count_gallery_photo_views(uuid) to authenticated;

-- ---------- Profile opens (free: 2/day) ----------
create or replace function public.record_profile_open(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_tier text;
  v_limit integer;
  v_day date := public.quota_utc_day();
  v_count integer;
  v_exists boolean;
  v_friend boolean;
begin
  if me is null or p_profile_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;

  if me = p_profile_id then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', null,
      'unlimited', true, 'tier', 'own'
    );
  end if;

  v_tier := public.viewer_access_tier(me);
  v_limit := public.profile_daily_limit(v_tier);

  if v_limit is null then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', null,
      'unlimited', true, 'tier', v_tier
    );
  end if;

  -- Friends always allowed (does not burn quota if already friends)
  select exists(
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = me and f.addressee_id = p_profile_id)
        or (f.requester_id = p_profile_id and f.addressee_id = me)
      )
  ) into v_friend;

  if v_friend then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', v_limit,
      'unlimited', true, 'tier', v_tier, 'via', 'friend'
    );
  end if;

  select exists(
    select 1 from public.daily_profile_opens
    where viewer_id = me and day = v_day and profile_id = p_profile_id
  ) into v_exists;

  if v_exists then
    select count(*)::integer into v_count
    from public.daily_profile_opens
    where viewer_id = me and day = v_day;
    return jsonb_build_object(
      'allowed', true, 'count', v_count, 'limit', v_limit,
      'unlimited', false, 'tier', v_tier, 'already', true
    );
  end if;

  select count(*)::integer into v_count
  from public.daily_profile_opens
  where viewer_id = me and day = v_day;

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'limit', v_limit,
      'unlimited', false, 'tier', v_tier, 'reason', 'daily_limit'
    );
  end if;

  insert into public.daily_profile_opens (viewer_id, day, profile_id)
  values (me, v_day, p_profile_id)
  on conflict do nothing;

  select count(*)::integer into v_count
  from public.daily_profile_opens
  where viewer_id = me and day = v_day;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'limit', v_limit,
    'unlimited', false, 'tier', v_tier
  );
end;
$$;

grant execute on function public.record_profile_open(uuid) to authenticated;

-- ---------- Swipe likes (free 10 / premium 100 / admin unlimited; pass free) ----------
create or replace function public.consume_swipe_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_tier text;
  v_limit integer;
  v_day date := public.quota_utc_day();
  v_count integer;
begin
  if me is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;

  v_tier := public.viewer_access_tier(me);
  v_limit := public.swipe_daily_limit(v_tier);

  if v_limit is null then
    return jsonb_build_object(
      'allowed', true, 'count', 0, 'limit', null,
      'unlimited', true, 'tier', v_tier
    );
  end if;

  insert into public.daily_swipe_counts (user_id, day, hit_count)
  values (me, v_day, 0)
  on conflict do nothing;

  select hit_count into v_count
  from public.daily_swipe_counts
  where user_id = me and day = v_day
  for update;

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false, 'count', v_count, 'limit', v_limit,
      'unlimited', false, 'tier', v_tier, 'reason', 'daily_limit'
    );
  end if;

  update public.daily_swipe_counts
  set hit_count = hit_count + 1
  where user_id = me and day = v_day
  returning hit_count into v_count;

  return jsonb_build_object(
    'allowed', true, 'count', v_count, 'limit', v_limit,
    'unlimited', false, 'tier', v_tier
  );
end;
$$;

grant execute on function public.consume_swipe_quota() to authenticated;

-- swipe_action: daily quota + premium/admin superlike
create or replace function public.swipe_action(
  p_to_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_tier text;
  v_mutual boolean := false;
  v_super boolean := false;
  v_had_like boolean := false;
  v_was_super boolean := false;
  v_quota jsonb;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;
  if p_to_id is null or p_to_id = me then
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;
  if p_action not in ('like', 'pass', 'superlike') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;

  v_tier := public.viewer_access_tier(me);

  -- Pass is free and unlimited — does not burn daily like quota
  if p_action = 'pass' then
    delete from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe';
    insert into public.profile_passes (from_id, to_id)
    values (me, p_to_id)
    on conflict do nothing;
    return jsonb_build_object('ok', true, 'action', 'pass', 'mutual', false);
  end if;

  -- Like / superlike: free 10/day, premium 100/day, admin unlimited
  v_quota := public.consume_swipe_quota();
  if coalesce((v_quota->>'allowed')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'swipe_daily_limit', 'quota', v_quota);
  end if;

  select exists(
    select 1 from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe'
  ), coalesce((
    select is_superlike from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe'
  ), false)
  into v_had_like, v_was_super;

  delete from public.profile_passes where from_id = me and to_id = p_to_id;

  if p_action = 'superlike' then
    if v_tier not in ('premium', 'admin') then
      return jsonb_build_object('ok', false, 'error', 'premium_required');
    end if;
    begin
      if v_tier <> 'admin' and not public.check_rate_limit('superlike', 15, 86400) then
        return jsonb_build_object('ok', false, 'error', 'superlike_limit');
      end if;
    exception
      when undefined_function then null;
    end;
    v_super := true;
  end if;

  if v_had_like then
    if v_super and not v_was_super then
      update public.profile_likes
      set is_superlike = true
      where from_id = me and to_id = p_to_id and source = 'swipe';
    end if;
  else
    insert into public.profile_likes (from_id, to_id, is_superlike, source)
    values (me, p_to_id, v_super, 'swipe')
    on conflict (from_id, to_id, source) do update
      set is_superlike = public.profile_likes.is_superlike or excluded.is_superlike;
  end if;

  select exists(
    select 1 from public.profile_likes
    where from_id = p_to_id and to_id = me and source = 'swipe'
  ) into v_mutual;

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'mutual', v_mutual,
    'is_superlike', v_super,
    'quota', v_quota
  );
exception
  when others then
    if sqlerrm like '%RATE_LIMIT%' then
      return jsonb_build_object('ok', false, 'error', 'rate_limit');
    end if;
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.swipe_action(uuid, text) to authenticated;
