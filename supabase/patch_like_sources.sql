-- =============================================================
--  Separate like streams: people (search) vs swipe
--  Run after patch_people_likes / patch_swipes
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.profile_likes
  add column if not exists is_superlike boolean not null default false;

alter table public.profile_likes
  add column if not exists source text not null default 'people';

-- Normalize legacy / empty
update public.profile_likes
set source = 'people'
where source is null or source = '';

-- Allow one like per pair PER source (search + swipe independent)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profile_likes'::regclass
      and c.contype = 'u'
  loop
    execute format('alter table public.profile_likes drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.profile_likes
  drop constraint if exists profile_likes_from_to_source_key;

alter table public.profile_likes
  add constraint profile_likes_from_to_source_key
  unique (from_id, to_id, source);

alter table public.profile_likes
  drop constraint if exists profile_likes_source_check;

alter table public.profile_likes
  add constraint profile_likes_source_check
  check (source in ('people', 'swipe'));

create index if not exists profile_likes_source_from_idx
  on public.profile_likes (source, from_id, created_at desc);
create index if not exists profile_likes_source_to_idx
  on public.profile_likes (source, to_id, created_at desc);

-- swipe_action: only touch / match source = swipe
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
    select 1 from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe'
  ), coalesce((
    select is_superlike from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe'
  ), false)
  into v_had_like, v_was_super;

  if p_action = 'pass' then
    delete from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe';
    insert into public.profile_passes (from_id, to_id)
    values (me, p_to_id)
    on conflict do nothing;
    return jsonb_build_object('ok', true, 'action', 'pass', 'mutual', false);
  end if;

  delete from public.profile_passes where from_id = me and to_id = p_to_id;

  if p_action = 'superlike' then
    select premium_until into v_premium from public.profiles where id = me;
    if v_premium is null or v_premium <= now() then
      return jsonb_build_object('ok', false, 'error', 'premium_required');
    end if;
    begin
      if not public.check_rate_limit('superlike', 15, 86400) then
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

  -- Mutual only if they also liked you via SWIPE
  select exists(
    select 1 from public.profile_likes
    where from_id = p_to_id and to_id = me and source = 'swipe'
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

-- Received SWIPE likes only
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
      where m.from_id = me
        and m.to_id = pl.from_id
        and m.source = 'swipe'
    ) as is_mutual
  from public.profile_likes pl
  where pl.to_id = me
    and pl.source = 'swipe'
  order by pl.is_superlike desc, pl.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.get_swipe_likes_received(integer) to authenticated;
