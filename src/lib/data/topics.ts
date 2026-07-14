import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TopicWithAuthor } from "@/lib/types";

/**
 * Fetch topics for the feed on the server.
 * Falls back to an empty list (never throws) so the UI can always render.
 */
export async function getTopics(
  tab: "new" | "popular",
  search?: string,
  currentUserId?: string | null
): Promise<TopicWithAuthor[]> {
  const supa = createClient() as any;

  let query = supa
    .from("topics")
    .select(
      `id, author_id, title, body, tags, media, status, view_count, like_count,
       comment_count, created_at, updated_at,
       author:profiles!topics_author_id_fkey (
         id, username, display_name, avatar_url, last_seen, premium_until
       )`
    )
    .eq("status", "active")
    .limit(30);

  if (search && search.trim()) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,tags.cs.{${q}}`);
  }

  query =
    tab === "new"
      ? query.order("created_at", { ascending: false })
      : query
          .order("like_count", { ascending: false })
          .order("comment_count", { ascending: false })
          .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("getTopics error:", error.message);
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
      .in("topic_id", topicsList.map((t: any) => t.id));

    if (reactions) {
      likedTopicIds = new Set(reactions.map((r: any) => r.topic_id));
    }
  }

  return topicsList.map((t: any) => {
    const author = Array.isArray(t.author) ? t.author[0] ?? null : t.author;
    return {
      ...t,
      author,
      liked_by_me: likedTopicIds.has(t.id),
    } as TopicWithAuthor;
  });
}
