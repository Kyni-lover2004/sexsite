import "server-only";
import { createClient } from "@/lib/supabase/server";

interface ConversationWithProfile {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    last_seen: string;
  } | null;
  lastMessage: {
    ciphertext: string;
    created_at: string;
    sender_id: string;
    metadata: { type: string } | null;
  } | null;
}

/**
 * Fetch all conversations for the current user, joining the other participant
 * and the most recent message for a preview.
 */
export async function getConversations(
  userId: string
): Promise<ConversationWithProfile[]> {
  const supa = createClient() as any;

  const { data: convs } = await supa
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!convs) return [];

  const enriched: ConversationWithProfile[] = await Promise.all(
    convs.map(async (c: any) => {
      const otherId = c.user_a === userId ? c.user_b : c.user_a;
      const { data: profile } = await supa
        .from("profiles")
        .select("id, username, display_name, avatar_url, last_seen")
        .eq("id", otherId)
        .single();

      const { data: msgs } = await supa
        .from("messages")
        .select("ciphertext, created_at, sender_id, metadata")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        ...c,
        otherUser: profile ?? null,
        lastMessage: msgs?.[0] ?? null,
      };
    })
  );

  return enriched;
}

/** Fetch or create a conversation between two users. Returns its id. */
export async function getOrCreateConversation(
  userA: string,
  userB: string
): Promise<string | null> {
  const supa = createClient() as any;
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];

  const { data: existing } = await supa
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  if (existing) return existing.id;

  const { data } = await supa
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();

  return data?.id ?? null;
}
