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
    premium_until: string | null;
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
        .select("id, username, display_name, avatar_url, last_seen, premium_until")
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

  // 1. Check if conversation already exists
  const { data: existing } = await supa
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  if (existing) return existing.id;

  // 2. Since it's a NEW conversation, check if initiator (userA) has premium or is an admin
  const { data: profile } = await supa
    .from("profiles")
    .select("premium_until, role")
    .eq("id", userA)
    .single();

  const isPremium =
    profile?.premium_until &&
    new Date(profile.premium_until) > new Date();

  const isBypassed = isPremium || profile?.role === "admin";

  if (!isBypassed) {
    // Count conversations initiated by userA today (UTC)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const isoStart = startOfToday.toISOString();

    const { count, error: countError } = await supa
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("initiator_id", userA)
      .gte("created_at", isoStart);

    if (countError) {
      console.error("Error counting daily chats:", countError);
    } else if (count !== null && count >= 2) {
      throw new Error("LIMIT_REACHED");
    }
  }

  // 3. Create the new conversation with initiator_id
  const { data, error: insertError } = await supa
    .from("conversations")
    .insert({ user_a: a, user_b: b, initiator_id: userA })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating conversation in getOrCreateConversation:", insertError);
  }

  return data?.id ?? null;
}
