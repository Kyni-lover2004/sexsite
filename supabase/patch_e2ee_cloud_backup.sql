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
