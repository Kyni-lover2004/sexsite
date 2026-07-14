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
  city         text,
  birth_date   date,                        -- age is derived, never stored raw
  gender       gender default 'prefer_not_to_say',
  last_seen    timestamptz default now(),   -- powers "online" indicator
  available_for_chat boolean default false, -- "готов(а) пообщаться сейчас"
  role         text not null default 'user',          -- 'user' | 'admin'
  is_banned    boolean not null default false,
  premium_until timestamptz,                          -- null = no premium
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.profiles
  add column if not exists dating_goal text;

-- Derived age helper (kept out of the table to avoid stale data)
create or replace function public.profile_age(bd date)
returns int language sql immutable as $$
  select case when bd is null then null
              else date_part('year', age(bd))::int end;
$$;

create index if not exists profiles_city_idx      on public.profiles (city);
create index if not exists profiles_gender_idx    on public.profiles (gender);
create index if not exists profiles_dating_goal_idx on public.profiles (dating_goal);
create index if not exists profiles_interests_idx on public.profiles using gin (interests);
create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_bio_trgm      on public.profiles using gin (bio gin_trgm_ops);

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
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  check (user_a <> user_b),
  -- normalise the pair so (a,b) and (b,a) are the same conversation
  unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx on public.conversations (user_a);
create index if not exists conversations_user_b_idx on public.conversations (user_b);

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
alter table public.encryption_keys enable row level security;
alter table public.topics          enable row level security;
alter table public.comments        enable row level security;
alter table public.reactions       enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

-- Profiles: readable by all authed users; writable only by owner
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
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

-- Conversations: only the two participants
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

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

-- Helper: increment view_count atomically (used by the topic page)
create or replace function public.increment_view_count(topic_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.topics set view_count = view_count + 1 where id = topic_id;
end $$;

-- Helper: check if the current user is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- =============================================================
--  ADMIN RLS POLICIES — admins can modify / delete anything
-- =============================================================
-- Admin can update any profile (e.g. ban)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin());

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

-- Storage RLS: avatars — authenticated users can read/upload
drop policy if exists "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar write" on storage.objects;
create policy "Avatar write" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "Avatar update" on storage.objects;
create policy "Avatar update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "Avatar delete" on storage.objects;
create policy "Avatar delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid() is not null);

-- Storage RLS: chat-images — authenticated users can read/upload (files are E2EE-encrypted)
drop policy if exists "Chat image read" on storage.objects;
create policy "Chat image read" on storage.objects
  for select using (bucket_id = 'chat-images' and auth.uid() is not null);

drop policy if exists "Chat image write" on storage.objects;
create policy "Chat image write" on storage.objects
  for insert with check (bucket_id = 'chat-images' and auth.uid() is not null);

-- Storage RLS: topic-media — authenticated can upload, all authenticated can read
drop policy if exists "Topic media read" on storage.objects;
create policy "Topic media read" on storage.objects
  for select using (bucket_id = 'topic-media');

drop policy if exists "Topic media write" on storage.objects;
create policy "Topic media write" on storage.objects
  for insert with check (bucket_id = 'topic-media' and auth.uid() is not null);

-- Storage RLS: profile-photos — authenticated can read/upload/manage.
drop policy if exists "Profile photo read" on storage.objects;
create policy "Profile photo read" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "Profile photo write" on storage.objects;
create policy "Profile photo write" on storage.objects
  for insert with check (bucket_id = 'profile-photos' and auth.role() = 'authenticated');

drop policy if exists "Profile photo update" on storage.objects;
create policy "Profile photo update" on storage.objects
  for update using (bucket_id = 'profile-photos' and auth.role() = 'authenticated');

drop policy if exists "Profile photo delete" on storage.objects;
create policy "Profile photo delete" on storage.objects
  for delete using (bucket_id = 'profile-photos' and auth.role() = 'authenticated');

-- =============================================================
--  REALTIME — broadcast message + typing changes
-- =============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
