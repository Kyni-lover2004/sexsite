-- =============================================================
--  Swipes: passes, superlike, swipe_action RPC
--  Supabase → SQL Editor → Run
-- =============================================================

-- Extend profile_likes
alter table public.profile_likes
  add column if not exists is_superlike boolean not null default false;

alter table public.profile_likes
  add column if not exists source text not null default 'people';

create index if not exists profile_likes_to_super_idx
  on public.profile_likes (to_id, is_superlike desc, created_at desc);

-- Passes (dislike / skip) — hide from deck
create table if not exists public.profile_passes (
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  constraint profile_passes_not_self check (from_id <> to_id)
);

create index if not exists profile_passes_from_idx
  on public.profile_passes (from_id, created_at desc);

alter table public.profile_passes enable row level security;

drop policy if exists profile_passes_select on public.profile_passes;
create policy profile_passes_select on public.profile_passes
  for select using (auth.uid() = from_id);

drop policy if exists profile_passes_insert on public.profile_passes;
create policy profile_passes_insert on public.profile_passes
  for insert with check (auth.uid() = from_id);

drop policy if exists profile_passes_delete on public.profile_passes;
create policy profile_passes_delete on public.profile_passes
  for delete using (auth.uid() = from_id);

-- Unified swipe action
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
  v_premium timestamptz;
  v_mutual boolean := false;
  v_super boolean := false;
  v_had_like boolean := false;
  v_was_super boolean := false;
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

  select exists(
    select 1 from public.profile_likes where from_id = me and to_id = p_to_id
  ), coalesce((
    select is_superlike from public.profile_likes
    where from_id = me and to_id = p_to_id
  ), false)
  into v_had_like, v_was_super;

  if p_action = 'pass' then
    -- remove pending like if any (pass wins)
    delete from public.profile_likes where from_id = me and to_id = p_to_id;
    insert into public.profile_passes (from_id, to_id)
    values (me, p_to_id)
    on conflict do nothing;
    return jsonb_build_object('ok', true, 'action', 'pass', 'mutual', false);
  end if;

  -- like / superlike
  delete from public.profile_passes where from_id = me and to_id = p_to_id;

  if p_action = 'superlike' then
    select premium_until into v_premium from public.profiles where id = me;
    if v_premium is null or v_premium <= now() then
      return jsonb_build_object('ok', false, 'error', 'premium_required');
    end if;
    -- soft limit: 15 superlikes / day (requires check_rate_limit from platform hardening)
    begin
      if not public.check_rate_limit('superlike', 15, 86400) then
        return jsonb_build_object('ok', false, 'error', 'superlike_limit');
      end if;
    exception
      when undefined_function then
        null; -- rate limit helper missing — allow superlike
    end;
    v_super := true;
  end if;

  if v_had_like then
    -- already liked: upgrade to superlike if requested
    if v_super and not v_was_super then
      update public.profile_likes
      set is_superlike = true, source = 'swipe'
      where from_id = me and to_id = p_to_id;
    end if;
  else
    insert into public.profile_likes (from_id, to_id, is_superlike, source)
    values (me, p_to_id, v_super, 'swipe')
    on conflict (from_id, to_id) do update
      set is_superlike = public.profile_likes.is_superlike or excluded.is_superlike,
          source = excluded.source;
  end if;

  select exists(
    select 1 from public.profile_likes
    where from_id = p_to_id and to_id = me
  ) into v_mutual;

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'mutual', v_mutual,
    'is_superlike', v_super
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

-- Who liked me (ordered: superlikes first)
create or replace function public.get_swipe_likes_received(p_limit integer default 50)
returns table (
  from_id uuid,
  is_superlike boolean,
  created_at timestamptz,
  is_mutual boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;
  return query
  select
    pl.from_id,
    pl.is_superlike,
    pl.created_at,
    exists(
      select 1 from public.profile_likes m
      where m.from_id = me and m.to_id = pl.from_id
    ) as is_mutual
  from public.profile_likes pl
  where pl.to_id = me
  order by pl.is_superlike desc, pl.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.get_swipe_likes_received(integer) to authenticated;
