-- =============================================================
--  In-app notifications
--  Supabase → SQL Editor → Run
-- =============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (type in (
                'friend_request',
                'friend_accepted',
                'guest',
                'chat_message',
                'support_reply',
                'topic_comment',
                'profile_like'
              )),
  title       text not null,
  body        text not null default '',
  link        text,
  actor_id    uuid references public.profiles (id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (auth.uid() = user_id);

-- Inserts only via SECURITY DEFINER helpers/triggers (no direct client insert).
drop policy if exists notifications_insert on public.notifications;

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_actor_id uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- Never notify yourself
  if p_actor_id is not null and p_actor_id = p_user_id then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link, actor_id, meta)
  values (p_user_id, p_type, p_title, coalesce(p_body, ''), p_link, p_actor_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- ---- Friendships ----
create or replace function public.trg_notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(display_name, username) into actor_name
    from public.profiles where id = new.requester_id;

    perform public.notify_user(
      new.addressee_id,
      'friend_request',
      'Новая заявка в друзья',
      coalesce(actor_name, 'Кто-то') || ' хочет добавить вас в друзья',
      '/friends',
      new.requester_id,
      jsonb_build_object('friendship_id', new.id)
    );
  elsif tg_op = 'UPDATE'
        and old.status = 'pending'
        and new.status = 'accepted' then
    select coalesce(display_name, username) into actor_name
    from public.profiles where id = new.addressee_id;

    perform public.notify_user(
      new.requester_id,
      'friend_accepted',
      'Заявка принята',
      coalesce(actor_name, 'Пользователь') || ' принял(а) вашу заявку в друзья',
      '/friends',
      new.addressee_id,
      jsonb_build_object('friendship_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_friendship on public.friendships;
create trigger trg_notify_friendship
  after insert or update of status on public.friendships
  for each row execute function public.trg_notify_friendship();

-- ---- Profile visits (guests) ----
create or replace function public.trg_notify_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select coalesce(display_name, username) into actor_name
  from public.profiles where id = new.visitor_id;

  perform public.notify_user(
    new.profile_id,
    'guest',
    'Новый гость',
    coalesce(actor_name, 'Кто-то') || ' смотрел(а) вашу анкету',
    '/guests',
    new.visitor_id,
    jsonb_build_object('visit_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_guest on public.profile_visits;
create trigger trg_notify_guest
  after insert on public.profile_visits
  for each row execute function public.trg_notify_guest();

-- Revisit (update visited_at) — throttle: only if previous visit older than 6h
create or replace function public.trg_notify_guest_revisit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if new.visited_at is not distinct from old.visited_at then
    return new;
  end if;
  -- Throttle spam on rapid reloads
  if old.visited_at > now() - interval '6 hours' then
    return new;
  end if;

  select coalesce(display_name, username) into actor_name
  from public.profiles where id = new.visitor_id;

  perform public.notify_user(
    new.profile_id,
    'guest',
    'Гость снова заглянул',
    coalesce(actor_name, 'Кто-то') || ' снова открыл(а) вашу анкету',
    '/guests',
    new.visitor_id,
    jsonb_build_object('visit_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_guest_revisit on public.profile_visits;
create trigger trg_notify_guest_revisit
  after update of visited_at on public.profile_visits
  for each row execute function public.trg_notify_guest_revisit();

-- ---- Chat messages (E2EE — body stays generic) ----
create or replace function public.trg_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  actor_name text;
  conv record;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  recipient := case
    when conv.user_a = new.sender_id then conv.user_b
    else conv.user_a
  end;

  select coalesce(display_name, username) into actor_name
  from public.profiles where id = new.sender_id;

  perform public.notify_user(
    recipient,
    'chat_message',
    'Новое сообщение',
    coalesce(actor_name, 'Собеседник') || ' написал(а) вам',
    '/chat/' || new.conversation_id::text,
    new.sender_id,
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'message_id', new.id,
      'is_image', coalesce(new.metadata->>'type' = 'image', false)
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_chat_message on public.messages;
create trigger trg_notify_chat_message
  after insert on public.messages
  for each row execute function public.trg_notify_chat_message();

-- ---- Topic comments ----
create or replace function public.trg_notify_topic_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  topic_author uuid;
  parent_author uuid;
  actor_name text;
  topic_title text;
begin
  select author_id, title into topic_author, topic_title
  from public.topics where id = new.topic_id;

  select coalesce(display_name, username) into actor_name
  from public.profiles where id = new.author_id;

  -- Notify topic owner
  if topic_author is not null and topic_author <> new.author_id then
    perform public.notify_user(
      topic_author,
      'topic_comment',
      'Комментарий к теме',
      coalesce(actor_name, 'Кто-то') || ' прокомментировал(а): ' || left(coalesce(topic_title, 'тему'), 60),
      '/topic/' || new.topic_id::text,
      new.author_id,
      jsonb_build_object('topic_id', new.topic_id, 'comment_id', new.id)
    );
  end if;

  -- Notify parent comment author on reply
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null
       and parent_author <> new.author_id
       and parent_author is distinct from topic_author then
      perform public.notify_user(
        parent_author,
        'topic_comment',
        'Ответ на комментарий',
        coalesce(actor_name, 'Кто-то') || ' ответил(а) вам',
        '/topic/' || new.topic_id::text,
        new.author_id,
        jsonb_build_object('topic_id', new.topic_id, 'comment_id', new.id, 'parent_id', new.parent_id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_topic_comment on public.comments;
create trigger trg_notify_topic_comment
  after insert on public.comments
  for each row execute function public.trg_notify_topic_comment();

-- ---- Support admin replies ----
create or replace function public.trg_notify_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_owner uuid;
  ticket_subject text;
begin
  if not new.is_admin then
    return new;
  end if;

  select user_id, subject into ticket_owner, ticket_subject
  from public.support_tickets where id = new.ticket_id;

  if ticket_owner is null or ticket_owner = new.sender_id then
    return new;
  end if;

  perform public.notify_user(
    ticket_owner,
    'support_reply',
    'Ответ поддержки',
    'Ответ по обращению: ' || left(coalesce(ticket_subject, 'поддержка'), 80),
    '/support',
    new.sender_id,
    jsonb_build_object('ticket_id', new.ticket_id, 'message_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_support_reply on public.support_messages;
create trigger trg_notify_support_reply
  after insert on public.support_messages
  for each row execute function public.trg_notify_support_reply();

-- ---- Optional: profile like ----
create or replace function public.trg_notify_profile_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select coalesce(display_name, username) into actor_name
  from public.profiles where id = new.from_id;

  perform public.notify_user(
    new.to_id,
    'profile_like',
    'Вам поставили интерес',
    coalesce(actor_name, 'Кто-то') || ' отметил(а) интерес к вам',
    '/people',
    new.from_id,
    jsonb_build_object('from_id', new.from_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_profile_like on public.profile_likes;
create trigger trg_notify_profile_like
  after insert on public.profile_likes
  for each row execute function public.trg_notify_profile_like();

-- Helpers for client
create or replace function public.count_unread_notifications()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select count(*)::integer
     from public.notifications
     where user_id = auth.uid() and read_at is null),
    0
  );
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  if p_ids is null then
    update public.notifications
    set read_at = now()
    where user_id = auth.uid() and read_at is null;
  else
    update public.notifications
    set read_at = now()
    where user_id = auth.uid()
      and read_at is null
      and id = any(p_ids);
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.count_unread_notifications() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Realtime (ignore error if already added)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
