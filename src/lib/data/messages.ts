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
    iv: string;
    created_at: string;
    sender_id: string;
    metadata: { type: string } | null;
  } | null;
  /** Peer public key for client-side last-message decrypt in inbox. */
  peerPublicKey: JsonWebKey | null;
}

/**
 * Inbox list without N+1: one query for conversations, one for profiles,
 * one for recent messages (reduced to last-per-conversation in memory).
 */
export async function getConversations(
  userId: string
): Promise<ConversationWithProfile[]> {
  const supa = createClient() as any;

  const { data: convs } = await supa
    .from("conversations")
    .select("id, user_a, user_b, created_at, updated_at")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!convs?.length) return [];

  const otherIds = Array.from(
    new Set(
      convs.map((c: any) => (c.user_a === userId ? c.user_b : c.user_a))
    )
  ) as string[];
  const convIds = convs.map((c: any) => c.id) as string[];

  // Parallel batch: profiles + keys + recent messages window.
  const [{ data: profiles }, { data: keys }, { data: recentMsgs }] =
    await Promise.all([
      supa
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, last_seen, premium_until"
        )
        .in("id", otherIds),
      supa
        .from("encryption_keys")
        .select("user_id, public_key")
        .in("user_id", otherIds),
      supa
        .from("messages")
        .select(
          "conversation_id, ciphertext, iv, created_at, sender_id, metadata"
        )
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(convIds.length * 8, 80), 400)),
    ]);

  const profileById = new Map<string, any>(
    (profiles ?? []).map((p: any) => [p.id, p])
  );
  const keyByUser = new Map<string, JsonWebKey>(
    (keys ?? []).map((k: any) => [k.user_id, k.public_key as JsonWebKey])
  );

  const lastByConv = new Map<string, any>();
  for (const msg of recentMsgs ?? []) {
    if (!lastByConv.has(msg.conversation_id)) {
      lastByConv.set(msg.conversation_id, msg);
    }
  }

  return convs.map((c: any) => {
    const otherId = c.user_a === userId ? c.user_b : c.user_a;
    const last = lastByConv.get(c.id);
    return {
      ...c,
      otherUser: profileById.get(otherId) ?? null,
      peerPublicKey: keyByUser.get(otherId) ?? null,
      lastMessage: last
        ? {
            ciphertext: last.ciphertext,
            iv: last.iv,
            created_at: last.created_at,
            sender_id: last.sender_id,
            metadata: last.metadata,
          }
        : null,
    };
  });
}

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

  const { data, error: insertError } = await supa
    .from("conversations")
    .insert({ user_a: a, user_b: b, initiator_id: userA })
    .select("id")
    .single();

  if (insertError) {
    // DB trigger also enforces the daily limit (cannot be bypassed via API).
    const msg = String(insertError.message ?? "");
    if (msg.includes("LIMIT_REACHED") || insertError.code === "P0001") {
      throw new Error("LIMIT_REACHED");
    }
    console.error(
      "Error creating conversation in getOrCreateConversation:",
      insertError
    );
  }

  return data?.id ?? null;
}
