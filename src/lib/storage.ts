"use client";

import { createClient } from "@/lib/supabase/client";

const PUBLIC_BUCKET = "profile-photos";
const PRIVATE_BUCKET = "profile-photos-private";

/**
 * Resolve a display URL for a gallery photo.
 * Private album photos use short-lived signed URLs when stored in the private bucket.
 */
export async function resolvePhotoUrl(opts: {
  url: string;
  storagePath: string;
  isPrivate?: boolean;
  expiresIn?: number;
}): Promise<string> {
  const { url, storagePath, isPrivate = false, expiresIn = 3600 } = opts;
  if (!isPrivate) return url;

  // Prefer private bucket signed URL
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through */
  }

  // Fallback: signed URL on public bucket path (still better than permanent hotlink share)
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(PUBLIC_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through */
  }

  return url;
}

export function photoBucket(isPrivate?: boolean): string {
  return isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
}
