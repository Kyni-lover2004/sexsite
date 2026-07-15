-- =============================================================
--  Friends + Guests fix: no duplicates, no reverse-pair mess
--  Supabase → SQL Editor → Run (safe to re-run)
-- =============================================================

-- ---------- VISITS: one row per (profile, visitor) ----------
delete from public.profile_visits a
using public.profile_visits b
where a.profile_id = b.profile_id
  and a.visitor_id = b.visitor_id
  and a.visited_at < b.visited_at;

delete from public.profile_visits a
using public.profile_visits b
where a.profile_id = b.profile_id
  and a.visitor_id = b.visitor_id
  and a.ctid < b.ctid;

create unique index if not exists profile_visits_pair_uidx
  on public.profile_visits (profile_id, visitor_id);

drop policy if exists profile_visits_select on public.profile_visits;
create policy profile_visits_select on public.profile_visits
  for select using (auth.uid() = profile_id);

drop policy if exists profile_visits_insert on public.profile_visits;
create policy profile_visits_insert on public.profile_visits
  for insert with check (auth.uid() = visitor_id and visitor_id <> profile_id);

drop policy if exists profile_visits_update on public.profile_visits;
create policy profile_visits_update on public.profile_visits
  for update using (auth.uid() = visitor_id) with check (auth.uid() = visitor_id);

create or replace function public.record_profile_visit(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_profile_id is null or auth.uid() = p_profile_id then
    return;
  end if;

  insert into public.profile_visits (profile_id, visitor_id, visited_at)
  values (p_profile_id, auth.uid(), now())
  on conflict (profile_id, visitor_id)
  do update set visited_at = excluded.visited_at;
end;
$$;

-- ---------- FRIENDSHIPS: one row per unordered pair ----------
delete from public.friendships f
using (
  select id
  from (
    select id,
      row_number() over (
        partition by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
        order by
          case status when 'accepted' then 0 when 'pending' then 1 else 2 end,
          coalesce(updated_at, created_at) desc,
          created_at desc
      ) as rn
    from public.friendships
  ) ranked
  where rn > 1
) d
where f.id = d.id;

create unique index if not exists friendships_pair_normalized_uidx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create or replace function public.request_friendship(p_other_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing public.friendships%rowtype;
begin
  if me is null then
    return 'not_auth';
  end if;
  if p_other_id is null or p_other_id = me then
    return 'self';
  end if;

  select * into existing
  from public.friendships
  where (requester_id = me and addressee_id = p_other_id)
     or (requester_id = p_other_id and addressee_id = me)
  limit 1;

  if found then
    if existing.status = 'accepted' then
      return 'already';
    end if;

    if existing.status = 'pending' and existing.requester_id = p_other_id then
      update public.friendships
      set status = 'accepted', updated_at = now()
      where id = existing.id;
      return 'accepted';
    end if;

    if existing.status = 'pending' and existing.requester_id = me then
      return 'sent';
    end if;

    if existing.status = 'declined' then
      update public.friendships
      set requester_id = me,
          addressee_id = p_other_id,
          status = 'pending',
          updated_at = now()
      where id = existing.id;
      return 'sent';
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (me, p_other_id, 'pending');
  return 'sent';
exception
  when unique_violation then
    select * into existing
    from public.friendships
    where (requester_id = me and addressee_id = p_other_id)
       or (requester_id = p_other_id and addressee_id = me)
    limit 1;

    if not found then
      return 'sent';
    end if;
    if existing.status = 'accepted' then
      return 'already';
    end if;
    if existing.status = 'pending' and existing.requester_id = p_other_id then
      update public.friendships
      set status = 'accepted', updated_at = now()
      where id = existing.id;
      return 'accepted';
    end if;
    return 'sent';
end;
$$;

create or replace function public.accept_friendship(p_other_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n integer := 0;
begin
  if me is null then
    return 'not_auth';
  end if;

  update public.friendships
  set status = 'accepted', updated_at = now()
  where requester_id = p_other_id
    and addressee_id = me
    and status = 'pending';

  get diagnostics n = row_count;
  if n > 0 then
    return 'accepted';
  end if;

  if exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = me and addressee_id = p_other_id)
        or (requester_id = p_other_id and addressee_id = me)
      )
  ) then
    return 'already';
  end if;

  return 'none';
end;
$$;

create or replace function public.remove_friendship(p_other_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n integer := 0;
begin
  if me is null then
    return false;
  end if;

  delete from public.friendships
  where (requester_id = me and addressee_id = p_other_id)
     or (requester_id = p_other_id and addressee_id = me);

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.record_profile_visit(uuid) to authenticated;
grant execute on function public.request_friendship(uuid) to authenticated;
grant execute on function public.accept_friendship(uuid) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
