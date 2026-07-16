import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GuestFriendStatus, GuestListItem } from "@/lib/types";

const GUESTS_WINDOW_MS = 24 * 60 * 60 * 1000;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Guests who opened the owner's profile in the last 24h,
 * with mutual-visit + friendship status enrichment.
 */
export async function getGuestsForUser(
  userId: string
): Promise<GuestListItem[]> {
  const supa = createClient() as any;
  const since = new Date(Date.now() - GUESTS_WINDOW_MS).toISOString();

  const [{ data: profile }, { data: visits }] = await Promise.all([
    supa
      .from("profiles")
      .select("guests_seen_at")
      .eq("id", userId)
      .maybeSingle(),
    supa
      .from("profile_visits")
      .select(
        `id, visited_at,
         visitor:profiles!profile_visits_visitor_id_fkey(
           id, username, display_name, avatar_url, last_seen, is_invisible
         )`
      )
      .eq("profile_id", userId)
      .gte("visited_at", since)
      .order("visited_at", { ascending: false })
      .limit(100),
  ]);

  const guestsSeenAt = profile?.guests_seen_at
    ? new Date(profile.guests_seen_at).getTime()
    : null;

  const seenVisitor = new Set<string>();
  const rows: {
    visitId: string;
    visitedAt: string;
    visitor: GuestListItem["visitor"];
  }[] = [];

  for (const raw of visits ?? []) {
    const visitor = one(raw.visitor) as GuestListItem["visitor"] | null;
    if (!visitor?.id || seenVisitor.has(visitor.id)) continue;
    seenVisitor.add(visitor.id);
    rows.push({
      visitId: raw.id,
      visitedAt: raw.visited_at,
      visitor,
    });
  }

  if (rows.length === 0) return [];

  const visitorIds = rows.map((r) => r.visitor.id);

  // Mutual: I also visited their profile at some point.
  const { data: mutualRows } = await supa
    .from("profile_visits")
    .select("profile_id")
    .eq("visitor_id", userId)
    .in("profile_id", visitorIds);

  const mutualSet = new Set(
    (mutualRows ?? []).map((r: { profile_id: string }) => r.profile_id)
  );

  // Friendships for this user; keep only rows involving our guests.
  const visitorIdSet = new Set(visitorIds);
  const { data: friendRows } = await supa
    .from("friendships")
    .select("status, requester_id, addressee_id")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const friendByOther = new Map<string, GuestFriendStatus>();
  for (const f of friendRows ?? []) {
    const otherId =
      f.requester_id === userId ? f.addressee_id : f.requester_id;
    if (!visitorIdSet.has(otherId)) continue;
    if (f.status === "accepted") {
      friendByOther.set(otherId, "accepted");
    } else if (f.status === "pending") {
      friendByOther.set(
        otherId,
        f.requester_id === userId ? "sent" : "received"
      );
    } else if (!friendByOther.has(otherId)) {
      friendByOther.set(otherId, "none");
    }
  }

  return rows.map((r) => {
    const visitedMs = new Date(r.visitedAt).getTime();
    const isNew =
      guestsSeenAt === null ? true : visitedMs > guestsSeenAt;

    return {
      visitId: r.visitId,
      visitedAt: r.visitedAt,
      isNew,
      isMutual: mutualSet.has(r.visitor.id),
      friendStatus: friendByOther.get(r.visitor.id) ?? "none",
      visitor: r.visitor,
    };
  });
}

export async function markGuestsSeen(): Promise<void> {
  const supa = createClient() as any;
  await supa.rpc("mark_guests_seen");
}

export async function countNewGuests(): Promise<number> {
  const supa = createClient() as any;
  const { data, error } = await supa.rpc("count_new_guests");
  if (error) {
    console.error("count_new_guests:", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
