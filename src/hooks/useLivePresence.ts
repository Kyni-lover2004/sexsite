"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresenceSnapshot = {
  last_seen: string | null;
  is_invisible: boolean;
};

const POLL_MS = 12_000;

/**
 * Live last_seen + is_invisible for one or many profiles.
 * Realtime UPDATE on profiles + short poll fallback (realtime may be off).
 */
export function useLivePresence(
  userIds: string | string[] | null | undefined,
  initialById?: Record<string, PresenceSnapshot>
): Record<string, PresenceSnapshot> {
  const ids = useMemo(() => {
    if (!userIds) return [] as string[];
    const raw = Array.isArray(userIds) ? userIds : [userIds];
    return Array.from(new Set(raw.filter(Boolean)));
  }, [userIds]);

  const idsKey = ids.slice().sort().join(",");

  const [map, setMap] = useState<Record<string, PresenceSnapshot>>(() => {
    const next: Record<string, PresenceSnapshot> = {};
    if (initialById) {
      for (const [id, snap] of Object.entries(initialById)) {
        next[id] = {
          last_seen: snap.last_seen ?? null,
          is_invisible: !!snap.is_invisible,
        };
      }
    }
    return next;
  });

  useEffect(() => {
    if (ids.length === 0) return;

    const tracked = ids;
    const supabase = createClient() as any;
    let cancelled = false;

    // Apply SSR seed once per id set (do not clobber fresher live data later).
    if (initialById) {
      setMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of tracked) {
          if (next[id]) continue;
          const seed = initialById[id];
          if (!seed) continue;
          next[id] = {
            last_seen: seed.last_seen ?? null,
            is_invisible: !!seed.is_invisible,
          };
          changed = true;
        }
        return changed ? next : prev;
      });
    }

    async function pull() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, last_seen, is_invisible")
        .in("id", tracked);
      if (cancelled || error || !data) return;

      setMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const row of data as Array<{
          id: string;
          last_seen: string | null;
          is_invisible: boolean | null;
        }>) {
          const snap: PresenceSnapshot = {
            last_seen: row.last_seen ?? null,
            is_invisible: !!row.is_invisible,
          };
          const cur = next[row.id];
          if (
            !cur ||
            cur.last_seen !== snap.last_seen ||
            cur.is_invisible !== snap.is_invisible
          ) {
            next[row.id] = snap;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    void pull();
    const poll = setInterval(() => void pull(), POLL_MS);

    // Realtime only for a single peer (open chat / profile). Multi-id lists
    // rely on poll — unfiltered profile broadcasts are too noisy.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (tracked.length === 1) {
      const peerId = tracked[0];
      channel = supabase
        .channel(`presence:${peerId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${peerId}`,
          },
          (payload: {
            new?: {
              id?: string;
              last_seen?: string | null;
              is_invisible?: boolean | null;
            };
          }) => {
            const row = payload.new;
            if (!row?.id) return;
            setMap((prev) => ({
              ...prev,
              [row.id!]: {
                last_seen: row.last_seen ?? null,
                is_invisible: !!row.is_invisible,
              },
            }));
          }
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
    // initialById only seeds missing keys once per mount of this id set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return map;
}

/** Convenience for a single peer. */
export function usePeerPresence(
  userId: string | null | undefined,
  initial?: PresenceSnapshot
): PresenceSnapshot {
  const initialById = useMemo(() => {
    if (!userId || !initial) return undefined;
    return { [userId]: initial };
  }, [userId, initial?.last_seen, initial?.is_invisible]);

  const map = useLivePresence(userId ?? null, initialById);
  if (!userId) {
    return { last_seen: null, is_invisible: false };
  }
  return (
    map[userId] ??
    initial ?? { last_seen: null, is_invisible: false }
  );
}
