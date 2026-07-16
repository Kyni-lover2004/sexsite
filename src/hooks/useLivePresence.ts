"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PRESENCE_EVENT,
  presenceChannelName,
  type PresenceBroadcastPayload,
} from "@/lib/presence-channel";

export type PresenceSnapshot = {
  last_seen: string | null;
  is_invisible: boolean;
};

/** Fast poll until realtime/broadcast is known good. */
const POLL_FAST_MS = 5_000;
/** Backup poll when live channels are subscribed. */
const POLL_SLOW_MS = 20_000;
/** Max peers to attach broadcast listeners (inbox). */
const MAX_BROADCAST_PEERS = 40;

/**
 * Live last_seen + is_invisible for one or many profiles.
 *
 * Layers (best → fallback):
 * 1. Realtime Broadcast from peer's PresenceTracker (instant online/invisible)
 * 2. postgres_changes on profiles (needs table in publication)
 * 3. Poll REST (always on as safety net)
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

  const liveOkRef = useRef(false);

  useEffect(() => {
    if (ids.length === 0) return;

    const tracked = ids;
    const supabase = createClient() as any;
    let cancelled = false;
    liveOkRef.current = false;

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

    function applySnap(id: string, snap: PresenceSnapshot) {
      setMap((prev) => {
        const cur = prev[id];
        if (
          cur &&
          cur.last_seen === snap.last_seen &&
          cur.is_invisible === snap.is_invisible
        ) {
          return prev;
        }
        return { ...prev, [id]: snap };
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

    // Adaptive poll interval
    let pollMs = POLL_FAST_MS;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function schedulePoll() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => void pull(), pollMs);
    }
    schedulePoll();

    function markLiveOk() {
      if (liveOkRef.current) return;
      liveOkRef.current = true;
      pollMs = POLL_SLOW_MS;
      schedulePoll();
    }

    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    function onBroadcastPayload(payload: {
      payload?: PresenceBroadcastPayload;
    }) {
      const p = payload.payload;
      if (!p?.userId || !tracked.includes(p.userId)) return;
      markLiveOk();

      // Invisible: hide completely (no last_seen, no green)
      if (p.invisible) {
        applySnap(p.userId, {
          last_seen: null,
          is_invisible: true,
        });
        return;
      }

      // Explicit offline (tab closed / went away) — green off, keep not-invisible
      if (!p.online) {
        setMap((prev) => ({
          ...prev,
          [p.userId]: {
            last_seen: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            is_invisible: prev[p.userId]?.is_invisible ?? false,
          },
        }));
        return;
      }

      // Online pulse
      applySnap(p.userId, {
        last_seen: p.at || new Date().toISOString(),
        is_invisible: false,
      });
    }

    // Broadcast listeners (instant; no DB publication required)
    const broadcastIds = tracked.slice(0, MAX_BROADCAST_PEERS);
    for (const peerId of broadcastIds) {
      const ch = supabase
        .channel(presenceChannelName(peerId), {
          config: { broadcast: { self: false } },
        })
        .on(
          "broadcast",
          { event: PRESENCE_EVENT },
          (payload: { payload?: PresenceBroadcastPayload }) =>
            onBroadcastPayload(payload)
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") markLiveOk();
        });
      channels.push(ch);
    }

    // postgres_changes: single peer only (chat / profile)
    if (tracked.length === 1) {
      const peerId = tracked[0];
      const ch = supabase
        .channel(`presence-pg:${peerId}`)
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
            markLiveOk();
            applySnap(row.id, {
              last_seen: row.last_seen ?? null,
              is_invisible: !!row.is_invisible,
            });
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") markLiveOk();
        });
      channels.push(ch);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      for (const ch of channels) {
        void supabase.removeChannel(ch);
      }
    };
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
