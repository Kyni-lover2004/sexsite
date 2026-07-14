import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Comment, Profile } from "@/lib/types";

export interface CommentWithAuthor extends Comment {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "premium_until"
  > | null;
}

/** Fetch all comments for a topic, ordered chronologically. */
export async function getComments(topicId: string): Promise<CommentWithAuthor[]> {
  const supa = createClient() as any;

  const { data } = await supa
    .from("comments")
    .select(
      `*,
       author:profiles!comments_author_id_fkey (
         id, username, display_name, avatar_url, premium_until
       )`
    )
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  return data.map((c: any) => {
    const author = Array.isArray(c.author) ? c.author[0] ?? null : c.author;
    return { ...c, author } as CommentWithAuthor;
  });
}

/** Record a view on a topic atomically. */
export async function incrementViewCount(topicId: string) {
  const supa = createClient() as any;
  await supa.rpc("increment_view_count", { topic_id: topicId });
}
