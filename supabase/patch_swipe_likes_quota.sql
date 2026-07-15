-- =============================================================
--  Swipe daily quota = LIKES only (pass free)
--  free: 10 likes/day · premium: 100 · admin: unlimited
--  Supabase → SQL Editor → Run
-- =============================================================

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

  -- Pass free — no quota
  if p_action = 'pass' then
    delete from public.profile_likes
    where from_id = me and to_id = p_to_id and source = 'swipe';
    insert into public.profile_passes (from_id, to_id)
    values (me, p_to_id)
    on conflict do nothing;
    return jsonb_build_object('ok', true, 'action', 'pass', 'mutual', false);
  end if;

  -- Like / superlike burn daily like quota
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
