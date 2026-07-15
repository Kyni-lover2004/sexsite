-- =============================================================
--  Social Platform — PostgreSQL / Supabase schema
--  Modules: Auth & Profiles, Topics (forum), Comments,
--           People/Dating, Secure E2EE Messenger
--
--  Apply with:  supabase db push   (or paste into the SQL editor)
-- =============================================================

-- Extensions ---------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fast ILIKE / live search

-- =============================================================
--  ENUMS
-- =============================================================
do $$ begin
  create type gender as enum ('male', 'female', 'other', 'prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type topic_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

-- =============================================================
--  PROFILES  (1:1 with auth.users)
--  Supabase manages auth.users; we mirror public profile data.
-- =============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  status       text,                       -- short custom status line
  bio          text,
  interests    text[] default '{}',         -- tags / interests
  dating_goal  text,                        -- why the person wants to meet
  dating_goals text[] default '{}',         -- selected meeting goals
  city         text,
  birth_date   date,                        -- age is derived, never stored raw
  gender       gender default 'prefer_not_to_say',
  last_seen    timestamptz default now(),   -- powers "online" indicator
  available_for_chat boolean default false, -- "готов(а) пообщаться сейчас"
  role         text not null default 'user',          -- 'user' | 'admin'
  is_banned    boolean not null default false,
  banned_until timestamptz,
  ban_reason   text,
  banned_by    uuid references public.profiles (id) on delete set null,
  banned_at    timestamptz,
  premium_until timestamptz,                          -- null = no premium
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.profiles
  add column if not exists dating_goal text,
  add column if not exists dating_goals text[] default '{}',
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists banned_by uuid references public.profiles (id) on delete set null,
  add column if not exists banned_at timestamptz,
  add column if not exists country text,
  add column if not exists region text;

alter table public.profiles
  add column if not exists looking_for text[] default '{}',
  add column if not exists age_preference text,
  add column if not exists meeting_place text[] default '{}',
  add column if not exists mobility text,
  add column if not exists height integer,
  add column if not exists weight integer,
  add column if not exists breast_size text,
  add column if not exists penis_size text,
  add column if not exists smoking_attitude text,
  add column if not exists drinking_attitude text,
  add column if not exists orientation_roles text[] default '{}',
  -- When the owner last opened /guests (for "new guests" badge).
  add column if not exists guests_seen_at timestamptz;

-- Keep existing single-goal profiles visible after enabling multi-select goals.
update public.profiles
set dating_goals = array[dating_goal]
where dating_goal is not null
  and coalesce(array_length(dating_goals, 1), 0) = 0;

-- Derived age helper (kept out of the table to avoid stale data)
create or replace function public.profile_age(bd date)
returns int language sql immutable as $$
  select case when bd is null then null
              else date_part('year', age(bd))::int end;
$$;

create index if not exists profiles_city_idx      on public.profiles (city);
create index if not exists profiles_country_idx   on public.profiles (country);
create index if not exists profiles_region_idx    on public.profiles (region);
create index if not exists profiles_gender_idx    on public.profiles (gender);
create index if not exists profiles_dating_goal_idx on public.profiles (dating_goal);
create index if not exists profiles_interests_idx on public.profiles using gin (interests);
create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_bio_trgm      on public.profiles using gin (bio gin_trgm_ops);
create index if not exists profiles_banned_until_idx on public.profiles (banned_until);
create index if not exists profiles_premium_until_idx on public.profiles (premium_until);

-- Profile gallery photos shown on a user's page.
create table if not exists public.profile_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  url         text not null,
  storage_path text not null,
  caption     text,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

create index if not exists profile_photos_user_idx
  on public.profile_photos (user_id, sort_order, created_at desc);

-- Profile visits shown only to the owner of the visited profile.
-- One row per (profile, visitor): revisit only bumps visited_at.
create table if not exists public.profile_visits (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  visitor_id  uuid not null references public.profiles (id) on delete cascade,
  visited_at  timestamptz not null default now(),
  constraint profile_visits_not_self check (profile_id <> visitor_id)
);
create index if not exists profile_visits_owner_idx
  on public.profile_visits (profile_id, visited_at desc);

-- Deduplicate legacy rows, then enforce uniqueness.
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

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- Collapse A→B and B→A duplicates (prefer accepted, then newest pending).
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

-- At most one friendship row per unordered pair of users.
create unique index if not exists friendships_pair_normalized_uidx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create table if not exists public.profile_videos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  url          text not null,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now()
);
create index if not exists profile_videos_user_idx
  on public.profile_videos (user_id, created_at desc);

create table if not exists public.profile_wall_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists profile_wall_posts_idx on public.profile_wall_posts (user_id, created_at desc);

-- =============================================================
--  ENCRYPTION KEYS  (E2EE)
--  Only the PUBLIC key lives on the server. The private key never
--  leaves the client (stored in browser IndexedDB / secure storage).
-- =============================================================
create table if not exists public.encryption_keys (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  public_key  jsonb not null,              -- exported JWK of the public key
  algorithm   text not null default 'ECDH-P256',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- =============================================================
--  TOPICS  (forum threads)
--  Business rule: a user may have only ONE 'active' topic at a time.
-- =============================================================
create table if not exists public.topics (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 3 and 160),
  body           text not null default '',
  tags           text[] default '{}',
  media          jsonb default '[]'::jsonb,  -- [{type:"image"|"video",url:"..."}]
  status         topic_status not null default 'active',
  view_count     bigint not null default 0,
  like_count     integer not null default 0,   -- denormalised (kept via triggers)
  comment_count  integer not null default 0,   -- denormalised
  type           text not null default 'discussion' check (type in ('discussion', 'promo', 'news')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Enforce "one active topic per author" at the DB level.
create unique index if not exists topics_one_active_per_author
  on public.topics (author_id)
  where (status = 'active');

create index if not exists topics_status_created_idx on public.topics (status, created_at desc);
create index if not exists topics_tags_idx           on public.topics using gin (tags);
create index if not exists topics_title_trgm         on public.topics using gin (title gin_trgm_ops);

-- Popularity score used by the "Popular" tab (weighted, time-decayed).
create or replace function public.topic_popularity(
  likes int, comments int, views bigint, created timestamptz
) returns numeric language sql immutable as $$
  select (likes * 3 + comments * 2 + views * 0.25)
         / power((extract(epoch from (now() - created)) / 3600) + 2, 1.5);
$$;

-- =============================================================
--  COMMENTS  (threaded / tree via parent_id)
-- =============================================================
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  like_count  integer not null default 0,
  created_at  timestamptz default now()
);

create index if not exists comments_topic_idx  on public.comments (topic_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);

-- =============================================================
--  REACTIONS  (likes / emoji on topics & comments)
-- =============================================================
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  topic_id    uuid references public.topics (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  emoji       text not null default '👍',
  created_at  timestamptz default now(),
  -- exactly one target
  check ((topic_id is not null) <> (comment_id is not null)),
  unique (user_id, topic_id, comment_id, emoji)
);

create index if not exists reactions_topic_idx   on public.reactions (topic_id);
create index if not exists reactions_comment_idx on public.reactions (comment_id);

-- =============================================================
--  CONVERSATIONS + MESSAGES  (secure DM)
--  Message bodies are ALWAYS ciphertext. The server cannot read them.
-- =============================================================
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references public.profiles (id) on delete cascade,
  user_b      uuid not null references public.profiles (id) on delete cascade,
  initiator_id uuid references public.profiles (id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  check (user_a <> user_b),
  -- normalise the pair so (a,b) and (b,a) are the same conversation
  unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx on public.conversations (user_a);
create index if not exists conversations_user_b_idx on public.conversations (user_b);
create index if not exists conversations_initiator_created_idx
  on public.conversations (initiator_id, created_at desc);
create index if not exists conversations_updated_idx
  on public.conversations (updated_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  -- E2EE payload: everything below is opaque ciphertext to the server
  ciphertext       text not null,          -- base64 AES-GCM ciphertext
  iv               text not null,          -- base64 initialisation vector
  -- ephemeral public key used for this message's ECDH (sender side)
  ephemeral_key    jsonb,
  read_at          timestamptz,
  created_at       timestamptz default now(),
  -- metadata for non-text messages (e.g. {"type":"image","storage_path":"...","file_iv":"..."})
  metadata         jsonb
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- =============================================================
--  SUPPORT  (user tickets answered by admins)
-- =============================================================
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  subject     text not null check (char_length(subject) between 3 and 160),
  status      text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  closed_at   timestamptz
);

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  is_admin    boolean not null default false,
  body        text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  check (
    char_length(body) <= 4000
    and (char_length(body) > 0 or jsonb_array_length(attachments) > 0)
  ),
  created_at  timestamptz default now()
);

alter table public.support_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.support_messages
  alter column body set default '';

do $$ begin
  alter table public.support_messages drop constraint support_messages_body_check;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.support_messages
    add constraint support_messages_body_or_attachment_check
    check (
      char_length(body) <= 4000
      and (char_length(body) > 0 or jsonb_array_length(attachments) > 0)
    );
exception when duplicate_object then null; end $$;

create index if not exists support_tickets_user_status_idx
  on public.support_tickets (user_id, status, updated_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status, updated_at desc);
create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

-- Helper: check if the current user is admin. Defined early because profile
-- guards and RLS policies both depend on it.
-- search_path is pinned so SECURITY DEFINER cannot be hijacked via path tricks.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.is_banned is distinct from old.is_banned
    or new.banned_until is distinct from old.banned_until
    or new.ban_reason is distinct from old.ban_reason
    or new.banned_by is distinct from old.banned_by
    or new.banned_at is distinct from old.banned_at
    or new.premium_until is distinct from old.premium_until then
    raise exception 'Only admins can update moderation and premium fields';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_profile_admin_fields on public.profiles;
create trigger trg_guard_profile_admin_fields before update on public.profiles
  for each row execute function public.guard_profile_admin_fields();

-- =============================================================
--  TRIGGERS — keep denormalised counters accurate
-- =============================================================
create or replace function public.bump_topic_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_topics_updated on public.topics;
create trigger trg_topics_updated before update on public.topics
  for each row execute function public.bump_topic_updated();

-- comment_count maintenance
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.topics set comment_count = comment_count + 1 where id = new.topic_id;
  elsif (tg_op = 'DELETE') then
    update public.topics set comment_count = greatest(comment_count - 1, 0) where id = old.topic_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count after insert or delete on public.comments
  for each row execute function public.sync_comment_count();

-- like_count maintenance (topic reactions only)
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') and new.topic_id is not null then
    update public.topics set like_count = like_count + 1 where id = new.topic_id;
  elsif (tg_op = 'DELETE') and old.topic_id is not null then
    update public.topics set like_count = greatest(like_count - 1, 0) where id = old.topic_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_like_count on public.reactions;
create trigger trg_like_count after insert or delete on public.reactions
  for each row execute function public.sync_like_count();

-- keep conversation.updated_at fresh on new messages (for sorting inbox)
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return null;
end $$;

drop trigger if exists trg_bump_conversation on public.messages;
create trigger trg_bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation();

create or replace function public.bump_support_ticket()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.support_tickets
    set
      updated_at = now(),
      status = case when new.is_admin then 'answered' else status end
    where id = new.ticket_id;
  elsif (tg_op = 'UPDATE') then
    new.updated_at = now();
    if new.status = 'closed' and old.status <> 'closed' then
      new.closed_at = now();
    elsif new.status <> 'closed' then
      new.closed_at = null;
    end if;
    return new;
  end if;
  return null;
end $$;

drop trigger if exists trg_support_ticket_message on public.support_messages;
create trigger trg_support_ticket_message after insert on public.support_messages
  for each row execute function public.bump_support_ticket();

drop trigger if exists trg_support_ticket_updated on public.support_tickets;
create trigger trg_support_ticket_updated before update on public.support_tickets
  for each row execute function public.bump_support_ticket();

-- auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
--  ROW LEVEL SECURITY
-- =============================================================
alter table public.profiles        enable row level security;
alter table public.profile_photos  enable row level security;
alter table public.profile_visits  enable row level security;
alter table public.friendships     enable row level security;
alter table public.profile_videos  enable row level security;
alter table public.profile_wall_posts enable row level security;
alter table public.encryption_keys enable row level security;
alter table public.topics          enable row level security;
alter table public.comments        enable row level security;
alter table public.reactions       enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Profiles: readable by all authed users; writable only by owner
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

-- Profile photos: readable by authed users; owner manages own gallery.
drop policy if exists profile_photos_select on public.profile_photos;
create policy profile_photos_select on public.profile_photos
  for select using (auth.role() = 'authenticated');
drop policy if exists profile_photos_insert on public.profile_photos;
create policy profile_photos_insert on public.profile_photos
  for insert with check (auth.uid() = user_id);
drop policy if exists profile_photos_update on public.profile_photos;
create policy profile_photos_update on public.profile_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists profile_photos_delete on public.profile_photos;
create policy profile_photos_delete on public.profile_photos
  for delete using (auth.uid() = user_id);

-- Visits: owner reads guests; visitor may upsert own visit row (or use RPC).
drop policy if exists profile_visits_select on public.profile_visits;
create policy profile_visits_select on public.profile_visits
  for select using (auth.uid() = profile_id);
drop policy if exists profile_visits_insert on public.profile_visits;
create policy profile_visits_insert on public.profile_visits
  for insert with check (auth.uid() = visitor_id and visitor_id <> profile_id);
drop policy if exists profile_visits_update on public.profile_visits;
create policy profile_visits_update on public.profile_visits
  for update using (auth.uid() = visitor_id) with check (auth.uid() = visitor_id);

-- Atomic visit log: insert or bump visited_at (no duplicates).
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

-- Owner opens /guests → clear "new guests" badge.
create or replace function public.mark_guests_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
  set guests_seen_at = now()
  where id = auth.uid();
end;
$$;

-- Count guests since last open (capped to last 24h window for the badge).
create or replace function public.count_new_guests()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  seen_at timestamptz;
  n integer := 0;
begin
  if me is null then
    return 0;
  end if;

  select guests_seen_at into seen_at
  from public.profiles
  where id = me;

  select count(*)::integer into n
  from public.profile_visits
  where profile_id = me
    and visited_at >= now() - interval '24 hours'
    and (
      seen_at is null
      or visited_at > seen_at
    );

  return coalesce(n, 0);
end;
$$;

grant execute on function public.mark_guests_seen() to authenticated;
grant execute on function public.count_new_guests() to authenticated;

-- Friend requests are visible and manageable only by their participants.
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert with check (auth.uid() = requester_id);
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Request / accept without reverse-pair duplicates.
-- Returns: 'sent' | 'accepted' | 'already' | 'self' | 'not_auth'
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

    -- They already sent us a request → mutual accept.
    if existing.status = 'pending' and existing.requester_id = p_other_id then
      update public.friendships
      set status = 'accepted', updated_at = now()
      where id = existing.id;
      return 'accepted';
    end if;

    -- We already sent pending.
    if existing.status = 'pending' and existing.requester_id = me then
      return 'sent';
    end if;

    -- Re-open declined as a fresh request from us.
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
    -- Race on the pair: re-resolve with the same rules.
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

-- Videos are publicly visible to members and managed by their owner.
drop policy if exists profile_videos_select on public.profile_videos;
create policy profile_videos_select on public.profile_videos
  for select using (auth.role() = 'authenticated');
drop policy if exists profile_videos_write on public.profile_videos;
create policy profile_videos_write on public.profile_videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists profile_wall_posts_select on public.profile_wall_posts;
create policy profile_wall_posts_select on public.profile_wall_posts
  for select using (auth.role() = 'authenticated');
drop policy if exists profile_wall_posts_insert on public.profile_wall_posts;
create policy profile_wall_posts_insert on public.profile_wall_posts
  for insert with check (auth.uid() = author_id and auth.uid() = user_id);
drop policy if exists profile_wall_posts_delete on public.profile_wall_posts;
create policy profile_wall_posts_delete on public.profile_wall_posts
  for delete using (auth.uid() = user_id or auth.uid() = author_id);

-- Encryption keys: public keys readable by all (needed to encrypt TO a user),
-- but only the owner may write their own key.
drop policy if exists keys_select on public.encryption_keys;
create policy keys_select on public.encryption_keys
  for select using (auth.role() = 'authenticated');
drop policy if exists keys_upsert on public.encryption_keys;
create policy keys_upsert on public.encryption_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Topics: everyone reads; author manages their own
drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics
  for select using (auth.role() = 'authenticated');
drop policy if exists topics_write on public.topics;
create policy topics_write on public.topics
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- Comments: everyone reads; author manages their own
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select using (auth.role() = 'authenticated');
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- Reactions: everyone reads; user manages own
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select using (auth.role() = 'authenticated');
drop policy if exists reactions_write on public.reactions;
create policy reactions_write on public.reactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Conversations: participants always; admins for moderation panel
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (
    auth.uid() = user_a or auth.uid() = user_b or public.is_admin()
  );
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (
    (auth.uid() = user_a or auth.uid() = user_b)
    and (initiator_id is null or initiator_id = auth.uid())
  );

-- Messages: only participants of the parent conversation
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
-- allow marking messages as read (participant may update read_at)
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Unique topic views: one counted view per authenticated user per topic.
create table if not exists public.topic_views (
  topic_id   uuid not null references public.topics (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (topic_id, user_id)
);
create index if not exists topic_views_user_idx on public.topic_views (user_id);

alter table public.topic_views enable row level security;
drop policy if exists topic_views_select on public.topic_views;
create policy topic_views_select on public.topic_views
  for select using (auth.uid() = user_id or public.is_admin());
-- Inserts go only through the SECURITY DEFINER RPC below.

-- Helper: count a view once per user (idempotent; no-op for anonymous).
create or replace function public.increment_view_count(topic_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.topic_views (topic_id, user_id)
  values (topic_id, auth.uid())
  on conflict (topic_id, user_id) do nothing;

  if found then
    update public.topics
    set view_count = view_count + 1
    where id = topic_id;
  end if;
end $$;

-- Helper: check if the current user is admin (re-assert search_path)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Free users: max 2 new conversations per UTC day (premium + admin unlimited).
-- Forces initiator_id = auth.uid() so the limit cannot be spoofed.
create or replace function public.guard_conversation_daily_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_premium_until timestamptz;
  v_count integer;
begin
  new.initiator_id := coalesce(new.initiator_id, auth.uid());

  if auth.uid() is null then
    return new;
  end if;

  -- Always attribute the create action to the authenticated caller.
  new.initiator_id := auth.uid();

  select role, premium_until
    into v_role, v_premium_until
  from public.profiles
  where id = auth.uid();

  if v_role = 'admin'
     or (v_premium_until is not null and v_premium_until > now()) then
    return new;
  end if;

  select count(*)::integer into v_count
  from public.conversations
  where initiator_id = auth.uid()
    and created_at >= date_trunc('day', timezone('utc', now()));

  if v_count >= 2 then
    raise exception 'LIMIT_REACHED'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_conversation_daily_limit on public.conversations;
create trigger trg_guard_conversation_daily_limit
  before insert on public.conversations
  for each row execute function public.guard_conversation_daily_limit();

-- Only admins may create promo/news topics; regular users stay on discussion.
create or replace function public.guard_topic_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type is distinct from 'discussion' and not public.is_admin() then
    new.type := 'discussion';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_topic_type on public.topics;
create trigger trg_guard_topic_type
  before insert or update of type on public.topics
  for each row execute function public.guard_topic_type();

-- Users (and the app shell) may clear only their own *expired* temporary ban.
-- Permanent bans (banned_until IS NULL) are never auto-cleared.
create or replace function public.clear_expired_ban()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.profiles
  set
    is_banned = false,
    banned_until = null,
    ban_reason = null,
    banned_by = null,
    banned_at = null
  where id = auth.uid()
    and is_banned = true
    and banned_until is not null
    and banned_until <= now();

  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Support: users manage their own tickets; admins manage all tickets.
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (auth.uid() = user_id);
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists support_tickets_delete on public.support_tickets;
create policy support_tickets_delete on public.support_tickets
  for delete using (public.is_admin());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert with check (
    sender_id = auth.uid() and (
      (public.is_admin() and is_admin = true) or (is_admin = false and exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id
          and t.user_id = auth.uid()
          and t.status <> 'closed'
      ))
    )
  );
drop policy if exists support_messages_delete on public.support_messages;
create policy support_messages_delete on public.support_messages
  for delete using (public.is_admin());

-- =============================================================
--  ADMIN RLS POLICIES — admins can modify / delete anything
-- =============================================================
-- Admin can update/delete any profile
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- Admin can delete any profile photos
drop policy if exists profile_photos_admin_delete on public.profile_photos;
create policy profile_photos_admin_delete on public.profile_photos
  for delete using (public.is_admin());

-- Admin can delete encryption keys
drop policy if exists keys_admin_delete on public.encryption_keys;
create policy keys_admin_delete on public.encryption_keys
  for delete using (public.is_admin());

-- Admin can delete any topic
drop policy if exists topics_admin_delete on public.topics;
create policy topics_admin_delete on public.topics
  for delete using (public.is_admin());

-- Admin can update any topic (e.g. archive)
drop policy if exists topics_admin_update on public.topics;
create policy topics_admin_update on public.topics
  for update using (public.is_admin());

-- Admin can delete any comment
drop policy if exists comments_admin_delete on public.comments;
create policy comments_admin_delete on public.comments
  for delete using (public.is_admin());

-- Admin can delete any reaction
drop policy if exists reactions_admin_delete on public.reactions;
create policy reactions_admin_delete on public.reactions
  for delete using (public.is_admin());

-- Admin can delete any conversation
drop policy if exists conversations_admin_delete on public.conversations;
create policy conversations_admin_delete on public.conversations
  for delete using (public.is_admin());

-- Admin can delete any message
drop policy if exists messages_admin_delete on public.messages;
create policy messages_admin_delete on public.messages
  for delete using (public.is_admin());

-- =============================================================
--  STORAGE BUCKETS  (for avatars & chat images)
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 10485760, array['application/octet-stream', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array['application/octet-stream', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'chat-images';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('topic-media', 'topic-media', true, 20971520, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'profile-photos';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-videos', 'profile-videos', true, 104857600, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'support-attachments';

-- Storage RLS helpers: path must start with the caller's uid folder.
-- Admins may delete moderation content across users.

-- Storage RLS: avatars — own folder only
drop policy if exists "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar write" on storage.objects;
create policy "Avatar write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar update" on storage.objects;
create policy "Avatar update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Avatar delete" on storage.objects;
create policy "Avatar delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Storage RLS: chat-images — encrypted blobs; any authed user may upload.
-- Reads still require auth (bucket is not public for casual browsing).
drop policy if exists "Chat image read" on storage.objects;
create policy "Chat image read" on storage.objects
  for select using (bucket_id = 'chat-images' and auth.uid() is not null);

drop policy if exists "Chat image write" on storage.objects;
create policy "Chat image write" on storage.objects
  for insert with check (bucket_id = 'chat-images' and auth.uid() is not null);

-- Storage RLS: topic-media — own folder only
drop policy if exists "Topic media read" on storage.objects;
create policy "Topic media read" on storage.objects
  for select using (bucket_id = 'topic-media');

drop policy if exists "Topic media write" on storage.objects;
create policy "Topic media write" on storage.objects
  for insert with check (
    bucket_id = 'topic-media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Topic media delete" on storage.objects;
create policy "Topic media delete" on storage.objects
  for delete using (
    bucket_id = 'topic-media'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Storage RLS: profile-photos — own folder; admins can delete for moderation.
drop policy if exists "Profile photo read" on storage.objects;
create policy "Profile photo read" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "Profile photo write" on storage.objects;
create policy "Profile photo write" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile photo update" on storage.objects;
create policy "Profile photo update" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Profile photo delete" on storage.objects;
create policy "Profile photo delete" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Profile video read" on storage.objects;
create policy "Profile video read" on storage.objects
  for select using (bucket_id = 'profile-videos');
drop policy if exists "Profile video write" on storage.objects;
create policy "Profile video write" on storage.objects
  for insert with check (
    bucket_id = 'profile-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Profile video delete" on storage.objects;
create policy "Profile video delete" on storage.objects
  for delete using (
    bucket_id = 'profile-videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Storage RLS: support-attachments — own folder only
drop policy if exists "Support attachment read" on storage.objects;
create policy "Support attachment read" on storage.objects
  for select using (bucket_id = 'support-attachments' and auth.uid() is not null);

drop policy if exists "Support attachment write" on storage.objects;
create policy "Support attachment write" on storage.objects
  for insert with check (
    bucket_id = 'support-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================
--  REALTIME — broadcast message + typing changes
-- =============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

create table if not exists public.profile_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profile_photos
  add column if not exists album_id uuid references public.profile_albums(id) on delete set null;

alter table public.profile_albums enable row level security;

create policy profile_albums_select on public.profile_albums
  for select using (true);

create policy profile_albums_insert on public.profile_albums
  for insert with check (auth.uid() = user_id);

create policy profile_albums_update on public.profile_albums
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy profile_albums_delete on public.profile_albums
  for delete using (auth.uid() = user_id);
