import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PEOPLE_SELECT } from "@/lib/data/people-shared";
import { isPremiumActive } from "@/lib/utils";

export async function getSwipeViewerMeta(userId: string | null): Promise<{
  isPremium: boolean;
  city: string | null;
  country: string | null;
  gender: string | null;
}> {
  if (!userId) {
    return { isPremium: false, city: null, country: null, gender: null };
  }
  const supa = createClient() as any;
  const { data } = await supa
    .from("profiles")
    .select("premium_until, city, country, gender")
    .eq("id", userId)
    .maybeSingle();
  return {
    isPremium: isPremiumActive(data?.premium_until),
    city: data?.city ?? null,
    country: data?.country ?? null,
    gender: data?.gender ?? null,
  };
}

/** Swipe-inbox badge — only likes from the swipe stream. */
export async function getReceivedLikesCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const supa = createClient() as any;
  const { count } = await supa
    .from("profile_likes")
    .select("from_id", { count: "exact", head: true })
    .eq("to_id", userId)
    .eq("source", "swipe");
  return count ?? 0;
}

export async function getProfilePhotoMap(
  userIds: string[]
): Promise<Record<string, { id: string; url: string; sort_order: number }[]>> {
  if (userIds.length === 0) return {};
  const supa = createClient() as any;
  // Main questionnaire photos only (not albums)
  const { data } = await supa
    .from("profile_photos")
    .select("id, user_id, url, sort_order, album_id")
    .in("user_id", userIds.slice(0, 80))
    .is("album_id", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const map: Record<string, { id: string; url: string; sort_order: number }[]> = {};
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    if (!map[uid]) map[uid] = [];
    if (map[uid].length >= 6) continue;
    map[uid].push({
      id: row.id,
      url: row.url,
      sort_order: row.sort_order ?? 0,
    });
  }
  return map;
}

export type { Profile };
export { PEOPLE_SELECT };
