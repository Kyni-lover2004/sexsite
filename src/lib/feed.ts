import type { Topic } from "@/lib/types";

/**
 * Client-side popularity score used by the "Popular" tab.
 * Mirrors the SQL topic_popularity() function: a weighted mix of likes,
 * comments and views, divided by a time-decay factor so fresh-but-hot
 * topics can outrank old ones with more raw engagement.
 */
export function scoreTopic(t: Pick<
  Topic,
  "like_count" | "comment_count" | "view_count" | "created_at"
>): number {
  const engagement = t.like_count * 3 + t.comment_count * 2 + t.view_count * 0.25;
  const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 3_600_000;
  const decay = Math.pow(ageHours + 2, 1.5);
  return engagement / decay;
}
