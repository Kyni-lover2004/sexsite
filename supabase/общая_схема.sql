-- =============================================================================
--  ОБЩАЯ СХЕМА — Desire Privé / web-mess
--  Полная прикладная логика public-схемы для self-hosted Supabase.
--
--  КОГДА ЗАПУСКАТЬ
--    1) Подняли self-hosted Supabase (Docker) — есть auth.users, storage и т.д.
--    2) В Studio → SQL Editor (или psql к Postgres) вставляете ЭТОТ файл целиком.
--
--  ЧТО ДЕЛАЕТ
--    • Таблицы, индексы, RLS, функции, триггеры, storage buckets policies
--    • Всё из schema.sql + все patch_*.sql (идемпотентно: if not exists / or replace)
--
--  ЧТО НЕ ДЕЛАЕТ
--    • Не создаёт auth.users / GoTrue / Kong (это Docker Supabase)
--    • Не переносит ДАННЫЕ с freesh cloud (для данных: scripts/db/export-from-supabase.sh)
--    • Не создаёт Storage FILES (фото) — только метаданные buckets/policies
--
--  ПОСЛЕ НАКАТА
--    update public.profiles set role = 'admin', is_owner = true
--    where id = '<ваш uuid из auth.users>';
--
--  Источник: supabase/schema.sql + patch_*.sql (снимок на момент сборки файла)
-- =============================================================================

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
  last_seen    timestamptz default now(),   -- public "online" indicator
  last_active_at timestamptz default now(), -- internal activity (retention / 30-day cleanup)
  available_for_chat boolean default false, -- "готов(а) пообщаться сейчас"
  role         text not null default 'user',          -- 'user' | 'admin'
  is_banned    boolean not null default false,
  banned_until timestamptz,
  ban_reason   text,
  banned_by    uuid references public.profiles (id) on delete set null,
  banned_at    timestamptz,
  premium_until timestamptz,                          -- null = no premium
  is_invisible boolean not null default false,        -- premium/admin: hide online + last_seen
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
  add column if not exists guests_seen_at timestamptz,
  -- Premium/admin: hide online status and last_seen from others.
  add column if not exists is_invisible boolean not null default false;

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

-- Dating interest / like (not friendship). Mutual like = soft match.
create table if not exists public.profile_likes (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  constraint profile_likes_not_self check (from_id <> to_id)
);
create index if not exists profile_likes_to_idx on public.profile_likes (to_id, created_at desc);
create index if not exists profile_likes_from_idx on public.profile_likes (from_id, created_at desc);

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

-- Passphrase-encrypted private key blob (server cannot decrypt without user passphrase).
create table if not exists public.e2ee_key_backups (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  v            integer not null default 1,
  alg          text not null default 'PBKDF2-AES-GCM',
  salt         text not null,
  iv           text not null,
  ciphertext   text not null,
  public_key   jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.e2ee_key_backups enable row level security;

drop policy if exists e2ee_backups_select on public.e2ee_key_backups;
create policy e2ee_backups_select on public.e2ee_key_backups
  for select using (auth.uid() = user_id);
drop policy if exists e2ee_backups_insert on public.e2ee_key_backups;
create policy e2ee_backups_insert on public.e2ee_key_backups
  for insert with check (auth.uid() = user_id);
drop policy if exists e2ee_backups_update on public.e2ee_key_backups;
create policy e2ee_backups_update on public.e2ee_key_backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists e2ee_backups_delete on public.e2ee_key_backups;
create policy e2ee_backups_delete on public.e2ee_key_backups
  for delete using (auth.uid() = user_id);

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
  is_pinned      boolean not null default false, -- admin pin (news / rules)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.topics
  add column if not exists is_pinned boolean not null default false;

-- Enforce "one active topic per author" at the DB level.
create unique index if not exists topics_one_active_per_author
  on public.topics (author_id)
  where (status = 'active');

create index if not exists topics_status_created_idx on public.topics (status, created_at desc);
create index if not exists topics_pinned_idx
  on public.topics (is_pinned desc, created_at desc)
  where (status = 'active');
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

-- Content reports (topics / comments)
create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 500),
  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'dismissed')),
  created_at   timestamptz not null default now(),
  check (
    (topic_id is not null and comment_id is null)
    or (topic_id is null and comment_id is not null)
  )
);

create unique index if not exists content_reports_topic_once
  on public.content_reports (reporter_id, topic_id)
  where topic_id is not null;
create unique index if not exists content_reports_comment_once
  on public.content_reports (reporter_id, comment_id)
  where comment_id is not null;
create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);

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
  metadata         jsonb,
  -- Quote/reply target (id only — body stays E2EE in ciphertext)
  reply_to_id      uuid references public.messages (id) on delete set null
);

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_reply_to_idx on public.messages (reply_to_id)
  where reply_to_id is not null;

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

-- Site owner (single super-admin): demote other admins, protected account
alter table public.profiles
  add column if not exists is_owner boolean not null default false;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_owner is distinct from old.is_owner then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can change the owner flag';
    end if;
  end if;

  if old.is_owner then
    if new.is_owner is distinct from true then
      raise exception 'Cannot remove the site owner flag from this account';
    end if;
    if new.role is distinct from 'admin' then
      raise exception 'Cannot demote the site owner';
    end if;
  end if;

  -- Demote admin → user: only site owner
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can remove admin privileges';
    end if;
  end if;

  if public.is_admin() or auth.uid() is null then
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
alter table public.profile_likes   enable row level security;
alter table public.profile_videos  enable row level security;
alter table public.profile_wall_posts enable row level security;
alter table public.encryption_keys enable row level security;
alter table public.topics          enable row level security;
alter table public.content_reports enable row level security;
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

-- Profile likes (dating interest)
drop policy if exists profile_likes_select on public.profile_likes;
create policy profile_likes_select on public.profile_likes
  for select using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists profile_likes_insert on public.profile_likes;
create policy profile_likes_insert on public.profile_likes
  for insert with check (auth.uid() = from_id);
drop policy if exists profile_likes_delete on public.profile_likes;
create policy profile_likes_delete on public.profile_likes
  for delete using (auth.uid() = from_id);

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

-- Only admins may pin / unpin topics.
create or replace function public.guard_topic_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_pinned is distinct from old.is_pinned and not public.is_admin() then
    raise exception 'Only admins can pin topics';
  end if;
  if tg_op = 'INSERT' and new.is_pinned and not public.is_admin() then
    new.is_pinned := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_topic_pin on public.topics;
create trigger trg_guard_topic_pin
  before insert or update of is_pinned on public.topics
  for each row execute function public.guard_topic_pin();

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

-- Reports: users file; admins review
drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports
  for select using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists content_reports_update on public.content_reports;
create policy content_reports_update on public.content_reports
  for update using (public.is_admin());
drop policy if exists content_reports_delete on public.content_reports;
create policy content_reports_delete on public.content_reports
  for delete using (public.is_admin());

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

drop policy if exists profile_albums_admin_delete on public.profile_albums;
create policy profile_albums_admin_delete on public.profile_albums
  for delete using (public.is_admin());

drop policy if exists profile_albums_admin_update on public.profile_albums;
create policy profile_albums_admin_update on public.profile_albums
  for update using (public.is_admin()) with check (public.is_admin());
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

-- end notifications patch


-- ========== PATCHES (order matters for some RPCs) ==========

-- ---------- patch_feed_features.sql ----------
-- =============================================================
--  Feed: pin topics + content reports
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.topics
  add column if not exists is_pinned boolean not null default false;

create index if not exists topics_pinned_idx
  on public.topics (is_pinned desc, created_at desc)
  where (status = 'active');

create or replace function public.guard_topic_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.is_pinned is distinct from old.is_pinned and not public.is_admin() then
    raise exception 'Only admins can pin topics';
  end if;
  if tg_op = 'INSERT' and new.is_pinned and not public.is_admin() then
    new.is_pinned := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_topic_pin on public.topics;
create trigger trg_guard_topic_pin
  before insert or update of is_pinned on public.topics
  for each row execute function public.guard_topic_pin();

create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 500),
  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'dismissed')),
  created_at   timestamptz not null default now(),
  check (
    (topic_id is not null and comment_id is null)
    or (topic_id is null and comment_id is not null)
  )
);

create unique index if not exists content_reports_topic_once
  on public.content_reports (reporter_id, topic_id)
  where topic_id is not null;
create unique index if not exists content_reports_comment_once
  on public.content_reports (reporter_id, comment_id)
  where comment_id is not null;
create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports
  for select using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists content_reports_update on public.content_reports;
create policy content_reports_update on public.content_reports
  for update using (public.is_admin());
drop policy if exists content_reports_delete on public.content_reports;
create policy content_reports_delete on public.content_reports
  for delete using (public.is_admin());

-- ---------- patch_friends_guests.sql ----------
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

-- ---------- patch_guests_features.sql ----------
-- =============================================================
--  Guests: new badge + mark seen
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.profiles
  add column if not exists guests_seen_at timestamptz;

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

-- ---------- patch_notifications.sql ----------
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

-- ---------- patch_people_likes.sql ----------
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

-- ---------- patch_swipes.sql ----------
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

-- ---------- patch_swipe_likes_quota.sql ----------
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

-- ---------- patch_like_sources.sql ----------
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

-- ---------- patch_daily_quotas.sql ----------
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

-- ---------- patch_platform_hardening.sql ----------
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

-- ---------- patch_chat_e2ee_ux.sql ----------
-- =============================================================
--  Chat UX: reply_to_id for quote/reply
--  Supabase → SQL Editor → Run
-- =============================================================

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

create index if not exists messages_reply_to_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

-- Realtime already includes messages; ensure UPDATE (read receipts) is published.
-- In Dashboard: Database → Replication → messages (insert, update).
-- Or:
-- alter publication supabase_realtime add table public.messages;
-- (no-op if already added)

-- ---------- patch_e2ee_cloud_backup.sql ----------
-- =============================================================
--  E2EE cloud backup (passphrase-encrypted private key blob)
--  Server NEVER sees the recovery passphrase — only ciphertext.
--  Owner-only RLS. Re-run safe.
-- =============================================================

set lock_timeout = '8s';
set statement_timeout = '60s';

create table if not exists public.e2ee_key_backups (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  -- Same shape as client EncryptedKeyBackup JSON fields
  v            integer not null default 1,
  alg          text not null default 'PBKDF2-AES-GCM',
  salt         text not null,
  iv           text not null,
  ciphertext   text not null,
  public_key   jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.e2ee_key_backups is
  'Passphrase-encrypted ECDH private key. Server cannot decrypt without user passphrase.';

alter table public.e2ee_key_backups enable row level security;

drop policy if exists e2ee_backups_select on public.e2ee_key_backups;
create policy e2ee_backups_select on public.e2ee_key_backups
  for select using (auth.uid() = user_id);

drop policy if exists e2ee_backups_insert on public.e2ee_key_backups;
create policy e2ee_backups_insert on public.e2ee_key_backups
  for insert with check (auth.uid() = user_id);

drop policy if exists e2ee_backups_update on public.e2ee_key_backups;
create policy e2ee_backups_update on public.e2ee_key_backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists e2ee_backups_delete on public.e2ee_key_backups;
create policy e2ee_backups_delete on public.e2ee_key_backups
  for delete using (auth.uid() = user_id);

-- Touch updated_at
create or replace function public.touch_e2ee_backup_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_e2ee_backup_updated on public.e2ee_key_backups;
create trigger trg_e2ee_backup_updated
  before update on public.e2ee_key_backups
  for each row
  execute function public.touch_e2ee_backup_updated_at();

set lock_timeout = 0;
set statement_timeout = 0;

-- ---------- patch_unread_messages.sql ----------
-- =============================================================
--  Unread messages badge for nav (like guests)
--  Supabase → SQL Editor → Run
-- =============================================================

create or replace function public.count_unread_messages()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select count(*)::integer
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.read_at is null
      and m.sender_id is distinct from auth.uid()
      and auth.uid() is not null
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ), 0);
$$;

grant execute on function public.count_unread_messages() to authenticated;

create index if not exists messages_unread_sender_idx
  on public.messages (sender_id, conversation_id)
  where read_at is null;

-- ---------- patch_invisible_mode.sql ----------
-- =============================================================
--  Invisible mode (premium + admin)
--  When enabled: no last_seen heartbeat, not listed as online,
--  presence/last-seen hidden from others in the app.
--
--  Re-run safe. Prefer running when app traffic is low.
--  Realtime for profiles is OPTIONAL — see bottom comments
--  (do NOT run ALTER PUBLICATION in the same batch under load).
-- =============================================================

-- Fail fast on lock waits instead of hanging / deadlocking forever.
set lock_timeout = '8s';
set statement_timeout = '60s';

-- 1) Column (no-op if already present)
alter table public.profiles
  add column if not exists is_invisible boolean not null default false;

-- 2) Index (skip if exists). Regular create — CONCURRENTLY cannot run
--    inside the SQL editor's implicit transaction.
create index if not exists profiles_is_invisible_idx
  on public.profiles (is_invisible)
  where is_invisible = true;

-- 3) Functions first (replace body without dropping table locks long)
create or replace function public.enforce_invisible_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_invisible, false) then
    if new.role is distinct from 'admin'
       and (new.premium_until is null or new.premium_until <= now()) then
      new.is_invisible := false;
    end if;
  end if;

  -- Instant offline for observers (online window ~2 min client-side).
  -- Only on UPDATE false→true; INSERT has no OLD.
  if tg_op = 'UPDATE'
     and coalesce(new.is_invisible, false)
     and not coalesce(old.is_invisible, false) then
    new.last_seen := now() - interval '3 minutes';
  end if;

  return new;
end;
$$;

-- Prefer full heartbeat from patch_last_active_retention.sql (last_active_at).
-- This fallback keeps invisible last_seen frozen but still bumps last_active_at
-- when that column already exists.
create or replace function public.heartbeat()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ts timestamptz := now();
  v_invisible boolean;
  v_role text;
  v_premium timestamptz;
  v_can_hide boolean;
  has_last_active boolean;
begin
  if me is null then
    return null;
  end if;

  select coalesce(is_invisible, false), role, premium_until
    into v_invisible, v_role, v_premium
  from public.profiles
  where id = me;

  if not found then
    return null;
  end if;

  v_can_hide :=
    v_role = 'admin'
    or (v_premium is not null and v_premium > now());

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'last_active_at'
  ) into has_last_active;

  -- Privilege lapsed while still flagged invisible: clear flag + resume presence.
  if v_invisible and not v_can_hide then
    if has_last_active then
      update public.profiles
      set is_invisible = false,
          last_seen = ts,
          last_active_at = ts
      where id = me;
    else
      update public.profiles
      set is_invisible = false,
          last_seen = ts
      where id = me;
    end if;
    return ts;
  end if;

  -- Invisible + still premium/admin → freeze public last_seen, keep activity.
  if v_invisible and v_can_hide then
    if has_last_active then
      update public.profiles
      set last_active_at = ts
      where id = me
        and (last_active_at is null or last_active_at < ts - interval '90 seconds');
    end if;
    return ts;
  end if;

  if has_last_active then
    update public.profiles
    set last_seen = ts,
        last_active_at = ts
    where id = me
      and (
        last_seen is null
        or last_seen < ts - interval '90 seconds'
        or last_active_at is null
        or last_active_at < ts - interval '90 seconds'
      );
  else
    update public.profiles
    set last_seen = ts
    where id = me
      and (last_seen is null or last_seen < ts - interval '90 seconds');
  end if;

  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;

-- 4) Trigger last (brief exclusive lock on profiles)
drop trigger if exists trg_enforce_invisible_privilege on public.profiles;
create trigger trg_enforce_invisible_privilege
  before insert or update of is_invisible, premium_until, role
  on public.profiles
  for each row
  execute function public.enforce_invisible_privilege();

-- Reset timeouts for the rest of the session (dashboard may keep connection)
set lock_timeout = 0;
set statement_timeout = 0;

-- =============================================================
-- OPTIONAL realtime (run SEPARATELY, only if needed):
-- App already polls every ~12s without this.
--
-- In Dashboard → Database → Publications → supabase_realtime
-- enable "profiles", OR run alone when traffic is quiet:
--
--   alter publication supabase_realtime add table public.profiles;
--
-- If already added: ERROR 42710 / duplicate_object — ignore.
-- =============================================================

-- ---------- patch_invisible_mode_realtime.sql ----------
-- =============================================================
--  OPTIONAL: enable Realtime for profiles (invisible / last_seen)
--  Run alone, not with other DDL, when traffic is low.
--  App works without this via polling (~12s).
-- =============================================================

set lock_timeout = '15s';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$$;

-- ---------- patch_last_active_retention.sql ----------
-- =============================================================
--  last_active_at — internal activity (retention / 30-day cleanup)
--  last_seen       — public "online" indicator only
--
--  Invisible mode freezes last_seen so others don't see you online,
--  but last_active_at keeps updating while the user uses the app.
--  Re-run safe.
-- =============================================================

set lock_timeout = '8s';
set statement_timeout = '60s';

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Backfill once for existing rows
update public.profiles
set last_active_at = coalesce(last_active_at, last_seen, created_at, now())
where last_active_at is null;

alter table public.profiles
  alter column last_active_at set default now();

-- Not null after backfill (safe if column already non-null)
do $$
begin
  alter table public.profiles
    alter column last_active_at set not null;
exception
  when others then null;
end;
$$;

create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at);

-- Heartbeat: always refresh last_active_at; last_seen only when visible.
create or replace function public.heartbeat()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ts timestamptz := now();
  v_invisible boolean;
  v_role text;
  v_premium timestamptz;
  v_can_hide boolean;
begin
  if me is null then
    return null;
  end if;

  select coalesce(is_invisible, false), role, premium_until
    into v_invisible, v_role, v_premium
  from public.profiles
  where id = me;

  if not found then
    return null;
  end if;

  v_can_hide :=
    v_role = 'admin'
    or (v_premium is not null and v_premium > now());

  -- Privilege lapsed while still flagged invisible: clear flag.
  if v_invisible and not v_can_hide then
    update public.profiles
    set is_invisible = false,
        last_seen = ts,
        last_active_at = ts
    where id = me;
    return ts;
  end if;

  -- Invisible (and still allowed): hide public presence, keep retention clock.
  if v_invisible and v_can_hide then
    update public.profiles
    set last_active_at = ts
    where id = me
      and (last_active_at is null or last_active_at < ts - interval '90 seconds');
    return ts;
  end if;

  -- Visible: both public last_seen and internal activity.
  update public.profiles
  set last_seen = ts,
      last_active_at = ts
  where id = me
    and (
      last_seen is null
      or last_seen < ts - interval '90 seconds'
      or last_active_at is null
      or last_active_at < ts - interval '90 seconds'
    );

  return ts;
end;
$$;

grant execute on function public.heartbeat() to authenticated;

-- 30-day inactivity cleanup uses last_active_at (not public last_seen).
-- Admins are never deleted. Call from pg_cron daily.
create or replace function public.delete_inactive_profiles(
  p_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_days is null or p_days < 1 then
    p_days := 30;
  end if;

  with doomed as (
    select id
    from public.profiles
    where coalesce(role, 'user') is distinct from 'admin'
      and coalesce(last_active_at, last_seen, created_at) < (now() - make_interval(days => p_days))
  ),
  del as (
    delete from public.profiles p
    using doomed d
    where p.id = d.id
    returning p.id
  )
  select count(*)::integer into n from del;

  return coalesce(n, 0);
end;
$$;

-- Optional: re-bind cron to the new function (ignore errors if pg_cron missing).
-- Use distinct $tag$ delimiters — nested $$ inside do $$ breaks parsing.
do $cron_setup$
begin
  -- Remove common old job names if present (no-op if absent)
  begin
    perform cron.unschedule('delete-inactive-users');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('cleanup-inactive-profiles');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('delete_inactive_profiles');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('delete-inactive-profiles');
  exception when others then null;
  end;

  perform cron.schedule(
    'delete-inactive-profiles',
    '0 3 * * *',
    $job$select public.delete_inactive_profiles(30);$job$
  );
exception
  when undefined_table then null;   -- cron schema missing
  when undefined_function then null;
  when others then null;
end;
$cron_setup$;

set lock_timeout = 0;
set statement_timeout = 0;

-- ---------- patch_profiles_realtime.sql ----------
-- =============================================================
--  Enable Realtime postgres_changes for profiles
--  (last_seen / is_invisible for open chats)
--
--  Instant online ALSO works via Broadcast (no SQL needed).
--  This patch is optional extra for DB-level updates.
--  Run alone when traffic is low.
-- =============================================================

set lock_timeout = '15s';

-- Primary key filters work with default replica identity;
-- FULL helps if you add more filter columns later.
do $body$
begin
  begin
    execute 'alter table public.profiles replica identity full';
  exception
    when others then null;
  end;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$body$;

set lock_timeout = 0;

-- ---------- patch_profile_reports.sql ----------
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

-- ---------- patch_admin_media_moderation.sql ----------
-- Admin moderation: delete any user's albums (and rely on photos.album_id ON DELETE SET NULL).
-- Storage delete for photos/avatars is already allowed for is_admin() in schema.
-- Supabase → SQL Editor → Run this patch.

drop policy if exists profile_albums_admin_delete on public.profile_albums;
create policy profile_albums_admin_delete on public.profile_albums
  for delete using (public.is_admin());

drop policy if exists profile_albums_admin_update on public.profile_albums;
create policy profile_albums_admin_update on public.profile_albums
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- patch_super_admin_owner.sql ----------
-- Site owner: only this account can demote admins ("Снять админа").
-- Supabase → SQL Editor → Run, then mark yourself:
--
--   update public.profiles
--   set is_owner = true, role = 'admin'
--   where username = 'ВАШ_USERNAME';
--   -- or: where id = 'uuid-из-auth';

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

create index if not exists profiles_is_owner_idx
  on public.profiles (is_owner)
  where is_owner = true;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is_owner changes: only current owner (or SQL session without auth.uid)
  if new.is_owner is distinct from old.is_owner then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can change the owner flag';
    end if;
  end if;

  -- Owner account is protected from demotion / losing owner flag via app
  if old.is_owner then
    if new.is_owner is distinct from true then
      raise exception 'Cannot remove the site owner flag from this account';
    end if;
    if new.role is distinct from 'admin' then
      raise exception 'Cannot demote the site owner';
    end if;
  end if;

  -- Demote admin → user: only site owner
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only the site owner can remove admin privileges';
    end if;
  end if;

  -- Other protected fields: any admin (or SQL without jwt)
  if public.is_admin() or auth.uid() is null then
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
end;
$$;

drop trigger if exists trg_guard_profile_admin_fields on public.profiles;
create trigger trg_guard_profile_admin_fields
  before update on public.profiles
  for each row execute function public.guard_profile_admin_fields();

-- =============================================================================
--  POST-INSTALL (optional, run manually with your user id)
-- =============================================================================
-- select id, email from auth.users;
-- update public.profiles set role = 'admin', is_owner = true where id = '...';
--
-- Storage: ensure buckets exist (schema inserts them). Upload files separately.
-- Realtime: enable tables in Dashboard if needed (profiles, messages, …).
-- =============================================================================
