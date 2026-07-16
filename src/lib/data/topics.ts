import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FeedPerson, TopicWithAuthor } from "@/lib/types";

const TOPIC_SELECT = `id, author_id, title, body, tags, media, status, view_count, like_count,
  comment_count, type, is_pinned, created_at, updated_at,
  author:profiles!topics_author_id_fkey (
    id, username, display_name, avatar_url, last_seen, is_invisible, premium_until
  )`;

/**
 * Fetch topics for the feed on the server.
 * Falls back to an empty list (never throws) so the UI can always render.
 */
export async function getTopics(
  tab: "new" | "popular" | "interests",
  search?: string,
  currentUserId?: string | null,
  tagFilter?: string | null,
  interestTags?: string[] | null
): Promise<TopicWithAuthor[]> {
  const supa = createClient() as any;

  let query = supa
    .from("topics")
    .select(TOPIC_SELECT)
    .eq("status", "active")
    .limit(50);

  if (search && search.trim()) {
    const q = search.trim().replace(/[%_,.()"'\\]/g, "").slice(0, 80);
    if (q) {
      query = query.or(`title.ilike.%${q}%,tags.cs.{${q}}`);
    }
  }

  if (tagFilter && tagFilter.trim()) {
    const tag = tagFilter.trim().replace(/[%_,.()"'\\{}]/g, "").slice(0, 40);
    if (tag) {
      query = query.contains("tags", [tag]);
    }
  }

  if (tab === "interests" && interestTags && interestTags.length > 0) {
    const clean = interestTags
      .map((t) => t.trim().replace(/[%_,.()"'\\{}]/g, "").slice(0, 40))
      .filter(Boolean)
      .slice(0, 12);
    if (clean.length > 0) {
      // Overlap any interest tag with topic.tags
      query = query.overlaps("tags", clean);
    }
  }

  // Pinned first, then tab order
  query = query
    .order("is_pinned", { ascending: false })
    .order(
      tab === "popular" ? "like_count" : "created_at",
      { ascending: false }
    );

  if (tab === "popular") {
    query = query.order("comment_count", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("getTopics error:", error.message);
    // Fallback without is_pinned if column missing pre-migration
    if (String(error.message).includes("is_pinned")) {
      return getTopicsLegacy(tab, search, currentUserId, tagFilter);
    }
    return [];
  }

  const topicsList = data ?? [];
  let likedTopicIds = new Set<string>();

  if (currentUserId && topicsList.length > 0) {
    const { data: reactions } = await supa
      .from("reactions")
      .select("topic_id")
      .eq("user_id", currentUserId)
      .eq("emoji", "👍")
      .in(
        "topic_id",
        topicsList.map((t: any) => t.id)
      );

    if (reactions) {
      likedTopicIds = new Set(reactions.map((r: any) => r.topic_id));
    }
  }

  return topicsList.map((t: any) => {
    const author = Array.isArray(t.author) ? t.author[0] ?? null : t.author;
    return {
      ...t,
      is_pinned: !!t.is_pinned,
      author,
      liked_by_me: likedTopicIds.has(t.id),
    } as TopicWithAuthor;
  });
}

async function getTopicsLegacy(
  tab: "new" | "popular" | "interests",
  search?: string,
  currentUserId?: string | null,
  tagFilter?: string | null
): Promise<TopicWithAuthor[]> {
  const supa = createClient() as any;
  let query = supa
    .from("topics")
    .select(
      `id, author_id, title, body, tags, media, status, view_count, like_count,
       comment_count, type, created_at, updated_at,
       author:profiles!topics_author_id_fkey (
         id, username, display_name, avatar_url, last_seen, is_invisible, premium_until
       )`
    )
    .eq("status", "active")
    .limit(40);

  if (search?.trim()) {
    const q = search.trim().replace(/[%_,.()"'\\]/g, "").slice(0, 80);
    if (q) query = query.or(`title.ilike.%${q}%,tags.cs.{${q}}`);
  }
  if (tagFilter?.trim()) {
    const tag = tagFilter.trim().replace(/[%_,.()"'\\{}]/g, "").slice(0, 40);
    if (tag) query = query.contains("tags", [tag]);
  }

  query =
    tab === "popular"
      ? query
          .order("like_count", { ascending: false })
          .order("comment_count", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data } = await query;
  return (data ?? []).map((t: any) => ({
    ...t,
    is_pinned: false,
    author: Array.isArray(t.author) ? t.author[0] ?? null : t.author,
  }));
}

/** People for mixed feed strip — same city or recently online. */
export async function getNearbyPeople(
  currentUserId: string | null,
  limit = 12
): Promise<FeedPerson[]> {
  if (!currentUserId) return [];
  const supa = createClient() as any;

  const { data: me } = await supa
    .from("profiles")
    .select("city, country, interests")
    .eq("id", currentUserId)
    .maybeSingle();

  let query = supa
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, last_seen, is_invisible, city, premium_until, available_for_chat"
    )
    .neq("id", currentUserId)
    .eq("is_banned", false)
    .order("last_seen", { ascending: false })
    .limit(limit);

  if (me?.city) {
    query = query.eq("city", me.city);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getNearbyPeople:", error.message);
    return [];
  }

  let rows = (data ?? []) as FeedPerson[];

  // Fallback: any recent if city empty
  if (rows.length < 4) {
    const { data: more } = await supa
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, last_seen, is_invisible, city, premium_until, available_for_chat"
      )
      .neq("id", currentUserId)
      .order("last_seen", { ascending: false })
      .limit(limit);
    const seen = new Set(rows.map((r) => r.id));
    for (const p of more ?? []) {
      if (!seen.has(p.id)) rows.push(p as FeedPerson);
      if (rows.length >= limit) break;
    }
  }

  return rows.slice(0, limit);
}

export async function getViewerInterestTags(
  userId: string | null
): Promise<string[]> {
  if (!userId) return [];
  const supa = createClient() as any;
  const { data } = await supa
    .from("profiles")
    .select("interests, dating_goals")
    .eq("id", userId)
    .maybeSingle();
  const tags = [
    ...((data?.interests as string[]) ?? []),
    ...((data?.dating_goals as string[]) ?? []),
  ]
    .map((t) => String(t).trim())
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 16);
}
