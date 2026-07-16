-- Admin moderation: delete any user's albums (and rely on photos.album_id ON DELETE SET NULL).
-- Storage delete for photos/avatars is already allowed for is_admin() in schema.
-- Supabase → SQL Editor → Run this patch.

drop policy if exists profile_albums_admin_delete on public.profile_albums;
create policy profile_albums_admin_delete on public.profile_albums
  for delete using (public.is_admin());

drop policy if exists profile_albums_admin_update on public.profile_albums;
create policy profile_albums_admin_update on public.profile_albums
  for update using (public.is_admin()) with check (public.is_admin());
