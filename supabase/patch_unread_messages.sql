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
