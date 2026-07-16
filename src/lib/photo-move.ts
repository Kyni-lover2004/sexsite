"use client";

import { createClient } from "@/lib/supabase/client";
import { photoBucket } from "@/lib/storage";

export type AlbumLike = {
  id: string;
  name?: string;
  is_private?: boolean | null;
};

export type PhotoLike = {
  id: string;
  url: string;
  storage_path: string;
  album_id?: string | null;
  user_id?: string;
};

/**
 * Move a profile photo to main (null) or another album.
 * Cross-bucket copy when privacy changes (public ↔ private).
 */
export async function moveProfilePhoto(opts: {
  photo: PhotoLike;
  targetAlbumId: string | null;
  albums: AlbumLike[];
}): Promise<{ ok: true; photo: PhotoLike } | { ok: false; error: string }> {
  const { photo, targetAlbumId, albums } = opts;
  const currentId = photo.album_id ?? null;
  if (currentId === targetAlbumId) {
    return { ok: true, photo };
  }

  const fromAlbum = currentId
    ? albums.find((a) => a.id === currentId)
    : undefined;
  const toAlbum = targetAlbumId
    ? albums.find((a) => a.id === targetAlbumId)
    : undefined;

  if (targetAlbumId && !toAlbum) {
    return { ok: false, error: "Альбом не найден" };
  }

  const fromPrivate = !!fromAlbum?.is_private;
  const toPrivate = !!toAlbum?.is_private;
  const supabase = createClient() as any;

  let nextUrl = photo.url;
  let nextPath = photo.storage_path;

  if (fromPrivate !== toPrivate) {
    const fromBucket = photoBucket(fromPrivate);
    const toBucket = photoBucket(toPrivate);

    const { data: blob, error: dlErr } = await supabase.storage
      .from(fromBucket)
      .download(photo.storage_path);
    if (dlErr || !blob) {
      return {
        ok: false,
        error: dlErr?.message ?? "Не удалось скачать файл для переноса",
      };
    }

    // Keep path; re-upload into target bucket
    const { error: upErr } = await supabase.storage
      .from(toBucket)
      .upload(photo.storage_path, blob, { upsert: true });
    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    await supabase.storage.from(fromBucket).remove([photo.storage_path]);

    if (toPrivate) {
      const { data: signed } = await supabase.storage
        .from(toBucket)
        .createSignedUrl(photo.storage_path, 3600);
      nextUrl =
        signed?.signedUrl ??
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${toBucket}/${photo.storage_path}`;
    } else {
      const { data } = supabase.storage
        .from(toBucket)
        .getPublicUrl(photo.storage_path);
      nextUrl = data.publicUrl;
    }
    nextPath = photo.storage_path;
  }

  const { data: updated, error } = await supabase
    .from("profile_photos")
    .update({
      album_id: targetAlbumId,
      url: nextUrl,
    })
    .eq("id", photo.id)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    photo: {
      id: updated.id,
      url: updated.url,
      storage_path: updated.storage_path ?? nextPath,
      album_id: updated.album_id ?? null,
      user_id: updated.user_id,
    },
  };
}
