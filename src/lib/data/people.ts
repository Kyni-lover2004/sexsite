import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import {
  PEOPLE_SELECT,
  ONLINE_WINDOW_MS,
  LIKE_SOURCE_PEOPLE,
  birthDateBounds,
  type PeopleCard,
  type PeopleSearchFilters,
  type PeopleTab,
} from "@/lib/data/people-shared";

export type { PeopleCard, PeopleSearchFilters, PeopleTab };
export { PEOPLE_SELECT, ONLINE_WINDOW_MS };

/**
 * Server-side people search with tab + filters (not client-only 60-row filter).
 */
export async function searchPeople(
  currentUserId: string | null,
  filters: PeopleSearchFilters = {}
): Promise<PeopleCard[]> {
  const supa = createClient() as any;
  const tab = filters.tab ?? "nearby";
  const limit = Math.min(filters.limit ?? 48, 80);

  let viewerCity: string | null = null;
  let viewerCountry: string | null = null;
  if (currentUserId) {
    const { data: me } = await supa
      .from("profiles")
      .select("city, country")
      .eq("id", currentUserId)
      .maybeSingle();
    viewerCity = me?.city ?? null;
    viewerCountry = me?.country ?? null;
  }

  if (tab === "mutual" && currentUserId) {
    return getMutualMatches(currentUserId, limit, filters);
  }

  let query = supa.from("profiles").select(PEOPLE_SELECT).limit(limit);

  if (currentUserId) {
    query = query.neq("id", currentUserId);
  }

  if (filters.gender) query = query.eq("gender", filters.gender);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.city) query = query.eq("city", filters.city);

  if (filters.interests?.length) {
    query = query.overlaps("interests", filters.interests.slice(0, 12));
  }
  if (filters.datingGoals?.length) {
    query = query.overlaps("dating_goals", filters.datingGoals.slice(0, 12));
  }

  const { minBirth, maxBirth } = birthDateBounds(
    filters.minAge,
    filters.maxAge
  );
  if (minBirth) query = query.gte("birth_date", minBirth);
  if (maxBirth) query = query.lte("birth_date", maxBirth);

  if (filters.query?.trim()) {
    const q = filters.query.trim().replace(/[%_,.()"'\\]/g, "").slice(0, 60);
    if (q) {
      query = query.or(
        `username.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%,bio.ilike.%${q}%`
      );
    }
  }

  if (tab === "online") {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    query = query
      .gte("last_seen", since)
      .order("last_seen", { ascending: false });
  } else if (tab === "available") {
    query = query
      .eq("available_for_chat", true)
      .order("last_seen", { ascending: false });
  } else if (tab === "nearby") {
    if (filters.city || viewerCity) {
      query = query.eq("city", filters.city || viewerCity);
    } else if (filters.country || viewerCountry) {
      query = query.eq("country", filters.country || viewerCountry);
    }
    query = query.order("last_seen", { ascending: false });
  } else {
    query = query.order("last_seen", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("searchPeople:", error.message);
    const { data: fallback } = await supa
      .from("profiles")
      .select(PEOPLE_SELECT)
      .neq("id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
      .order("last_seen", { ascending: false })
      .limit(limit);
    return enrichWithLikes(currentUserId, (fallback ?? []) as Profile[]);
  }

  let rows = (data ?? []) as Profile[];

  if (tab === "nearby" && rows.length < 6 && !filters.city && viewerCity) {
    const { data: more } = await supa
      .from("profiles")
      .select(PEOPLE_SELECT)
      .neq("id", currentUserId)
      .order("last_seen", { ascending: false })
      .limit(limit);
    const seen = new Set(rows.map((r) => r.id));
    for (const p of more ?? []) {
      if (!seen.has(p.id)) rows.push(p as Profile);
      if (rows.length >= limit) break;
    }
  }

  return enrichWithLikes(currentUserId, rows);
}

async function getMutualMatches(
  userId: string,
  limit: number,
  filters: PeopleSearchFilters
): Promise<PeopleCard[]> {
  const supa = createClient() as any;

  // Mutual only within search (people) likes — not swipe
  const [{ data: iLiked }, { data: likedMe }] = await Promise.all([
    supa
      .from("profile_likes")
      .select("to_id")
      .eq("from_id", userId)
      .eq("source", LIKE_SOURCE_PEOPLE),
    supa
      .from("profile_likes")
      .select("from_id")
      .eq("to_id", userId)
      .eq("source", LIKE_SOURCE_PEOPLE),
  ]);

  const likedByMe = new Set((iLiked ?? []).map((r: any) => r.to_id as string));
  const whoLikedMe = new Set(
    (likedMe ?? []).map((r: any) => r.from_id as string)
  );
  const mutualIds = [...likedByMe].filter((id) => whoLikedMe.has(id));
  if (mutualIds.length === 0) return [];

  let query = supa
    .from("profiles")
    .select(PEOPLE_SELECT)
    .in("id", mutualIds.slice(0, 100))
    .order("last_seen", { ascending: false })
    .limit(limit);

  if (filters.gender) query = query.eq("gender", filters.gender);
  if (filters.city) query = query.eq("city", filters.city);

  const { data } = await query;
  return ((data ?? []) as Profile[]).map((p) => ({
    ...p,
    iLiked: true,
    likedMe: true,
    isMutual: true,
  }));
}

async function enrichWithLikes(
  currentUserId: string | null,
  profiles: Profile[]
): Promise<PeopleCard[]> {
  if (!currentUserId || profiles.length === 0) {
    return profiles.map((p) => ({ ...p }));
  }

  const ids = profiles.map((p) => p.id);
  const supa = createClient() as any;

  const [{ data: fromMe }, { data: toMe }] = await Promise.all([
    supa
      .from("profile_likes")
      .select("to_id")
      .eq("from_id", currentUserId)
      .eq("source", LIKE_SOURCE_PEOPLE)
      .in("to_id", ids),
    supa
      .from("profile_likes")
      .select("from_id")
      .eq("to_id", currentUserId)
      .eq("source", LIKE_SOURCE_PEOPLE)
      .in("from_id", ids),
  ]);

  const iLiked = new Set((fromMe ?? []).map((r: any) => r.to_id as string));
  const likedMe = new Set((toMe ?? []).map((r: any) => r.from_id as string));

  return profiles.map((p) => ({
    ...p,
    iLiked: iLiked.has(p.id),
    likedMe: likedMe.has(p.id),
    isMutual: iLiked.has(p.id) && likedMe.has(p.id),
  }));
}

export async function getViewerLocation(userId: string | null): Promise<{
  city: string | null;
  country: string | null;
}> {
  if (!userId) return { city: null, country: null };
  const supa = createClient() as any;
  const { data } = await supa
    .from("profiles")
    .select("city, country")
    .eq("id", userId)
    .maybeSingle();
  return { city: data?.city ?? null, country: data?.country ?? null };
}
