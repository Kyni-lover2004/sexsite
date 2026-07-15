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
