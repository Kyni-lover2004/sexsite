"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  PRESENCE_EVENT,
  presenceChannelName,
  type PresenceBroadcastPayload,
} from "@/lib/presence-channel";

/** How often we refresh ban status while the tab is open. */
const BAN_CHECK_MS = 60_000;
/** Minimum gap between last_seen writes (DB heartbeat). */
const PRESENCE_MIN_MS = 60_000;
/** How often we pulse "I'm online" over Realtime Broadcast (instant for peers). */
const LIVE_PULSE_MS = 20_000;

/** Dispatched from profile toggle so heartbeat stops in the same tab immediately. */
export const INVISIBLE_MODE_EVENT = "dp:invisible-mode";

/**
 * Lightweight presence + ban overlay.
 * - DB heartbeat: last_seen / last_active_at (retention + offline lists)
 * - Realtime Broadcast: instant green/invisible for open chats (no SQL publication needed)
 */
export function PresenceTracker() {
  const supabase = useMemo(() => createClient(), []);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const lastPresenceRef = useRef(0);
  const lastBanCheckRef = useRef(0);
  const invisibleRef = useRef(false);
  const liveChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveUserId(): Promise<string | null> {
      if (userIdRef.current) return userIdRef.current;
      // getSession is local/cookie-based — cheaper than getUser() round-trip.
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      userIdRef.current = id;
      return id;
    }

    async function ensureLiveChannel(userId: string) {
      if (liveChannelRef.current) return liveChannelRef.current;
      const ch = supabase.channel(presenceChannelName(userId), {
        config: { broadcast: { self: false } },
      });
      liveChannelRef.current = ch;
      await new Promise<void>((resolve) => {
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
            resolve();
          }
        });
        // Don't hang forever if realtime is down
        setTimeout(() => resolve(), 2500);
      });
      return ch;
    }

    async function broadcastLive(
      online: boolean,
      opts?: { invisible?: boolean }
    ) {
      const userId = await resolveUserId();
      if (!userId || cancelled) return;
      try {
        const ch = await ensureLiveChannel(userId);
        const payload: PresenceBroadcastPayload = {
          userId,
          online,
          invisible: opts?.invisible ?? invisibleRef.current,
          at: new Date().toISOString(),
        };
        await ch.send({
          type: "broadcast",
          event: PRESENCE_EVENT,
          payload,
        });
      } catch {
        /* realtime optional */
      }
    }

    async function refreshInvisibleFlag() {
      const userId = await resolveUserId();
      if (!userId || cancelled) return;

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("is_invisible, premium_until, role")
        .eq("id", userId)
        .maybeSingle();

      if (!profile || cancelled) return;

      const premiumOk =
        !!profile.premium_until &&
        new Date(profile.premium_until).getTime() > Date.now();
      const canHide = profile.role === "admin" || premiumOk;
      const next = !!profile.is_invisible && canHide;
      const was = invisibleRef.current;
      invisibleRef.current = next;
      if (next && !was) {
        void broadcastLive(false, { invisible: true });
      } else if (!next && was) {
        void broadcastLive(true, { invisible: false });
      }
    }

    async function touchPresence(force = false) {
      const userId = await resolveUserId();
      if (!userId || cancelled) return;

      const now = Date.now();
      if (!force && now - lastPresenceRef.current < PRESENCE_MIN_MS) return;
      lastPresenceRef.current = now;

      // Always re-read flag; heartbeat still runs when invisible so last_active_at
      // (retention / 30-day cleanup) keeps ticking. Public last_seen is frozen server-side.
      await refreshInvisibleFlag();

      // Heartbeat RPC rate-limits writes (~90s). Invisible → only last_active_at.
      const { error } = await supabase.rpc("heartbeat" as never);
      if (error) {
        const ts = new Date().toISOString();
        if (invisibleRef.current) {
          // Retention only — never revive public "online" while invisible.
          await (supabase as any)
            .from("profiles")
            .update({ last_active_at: ts })
            .eq("id", userId);
        } else {
          await (supabase as any)
            .from("profiles")
            .update({ last_seen: ts, last_active_at: ts })
            .eq("id", userId)
            .eq("is_invisible", false);
        }
      }
    }

    async function pulseLive() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      await refreshInvisibleFlag();
      if (invisibleRef.current) {
        // Stay silent while invisible (already announced offline on toggle).
        return;
      }
      void broadcastLive(true, { invisible: false });
    }

    async function checkBan(force = false) {
      const userId = await resolveUserId();
      if (!userId || cancelled) {
        if (!userId) setIsBanned(false);
        return;
      }

      const now = Date.now();
      if (!force && now - lastBanCheckRef.current < BAN_CHECK_MS) return;
      lastBanCheckRef.current = now;

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("is_banned, banned_until")
        .eq("id", userId)
        .maybeSingle();

      if (!profile || cancelled) return;

      const until = profile.banned_until
        ? new Date(profile.banned_until)
        : null;
      const isBannedActive =
        !!profile.is_banned &&
        (!until || until.getTime() > Date.now());

      if (profile.is_banned && until && until.getTime() <= Date.now()) {
        await (supabase as any).rpc("clear_expired_ban");
        if (!cancelled) {
          setIsBanned(false);
          setBannedUntil(null);
        }
        return;
      }

      if (!cancelled) {
        setIsBanned(isBannedActive);
        setBannedUntil(profile.banned_until);
      }
    }

    // Initial pass: ban check + presence once.
    void checkBan(true);
    void touchPresence(true);
    void pulseLive();

    const banInterval = setInterval(() => void checkBan(), BAN_CHECK_MS);
    const presenceInterval = setInterval(
      () => void touchPresence(),
      PRESENCE_MIN_MS
    );
    const liveInterval = setInterval(() => void pulseLive(), LIVE_PULSE_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        // Soft offline for peers watching this tab
        if (!invisibleRef.current) {
          void broadcastLive(false, { invisible: false });
        }
        return;
      }
      void checkBan();
      void touchPresence();
      void pulseLive();
    };

    // Activity only marks "user is here" — presence write is still rate-limited.
    let activityTimer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      if (activityTimer) return;
      activityTimer = setTimeout(() => {
        activityTimer = null;
        void touchPresence();
        void pulseLive();
      }, 5_000);
    };

    // Same-tab toggle from profile UI — stop/resume without waiting for poll.
    const onInvisibleEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ invisible?: boolean }>).detail;
      if (typeof detail?.invisible === "boolean") {
        invisibleRef.current = detail.invisible;
        if (detail.invisible) {
          void broadcastLive(false, { invisible: true });
        } else {
          void broadcastLive(true, { invisible: false });
          void touchPresence(true);
        }
      } else {
        void refreshInvisibleFlag();
      }
    };

    const onPageHide = () => {
      if (!invisibleRef.current) {
        void broadcastLive(false, { invisible: false });
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener(INVISIBLE_MODE_EVENT, onInvisibleEvent);
    window.addEventListener("pagehide", onPageHide);

    // Realtime: own profile is_invisible changes (other tabs / devices).
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const userId = await resolveUserId();
      if (!userId || cancelled) return;
      await ensureLiveChannel(userId);
      profileChannel = supabase
        .channel(`own-presence:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload: {
            new?: {
              is_invisible?: boolean | null;
              premium_until?: string | null;
              role?: string | null;
            };
          }) => {
            const row = payload.new;
            if (!row) return;
            const premiumOk =
              !!row.premium_until &&
              new Date(row.premium_until).getTime() > Date.now();
            const canHide = row.role === "admin" || premiumOk;
            const next = !!row.is_invisible && canHide;
            const was = invisibleRef.current;
            invisibleRef.current = next;
            if (next && !was) void broadcastLive(false, { invisible: true });
            if (!next && was) void broadcastLive(true, { invisible: false });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearInterval(banInterval);
      clearInterval(presenceInterval);
      clearInterval(liveInterval);
      if (activityTimer) clearTimeout(activityTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener(INVISIBLE_MODE_EVENT, onInvisibleEvent);
      window.removeEventListener("pagehide", onPageHide);
      if (profileChannel) void supabase.removeChannel(profileChannel);
      if (liveChannelRef.current) {
        void supabase.removeChannel(liveChannelRef.current);
        liveChannelRef.current = null;
      }
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (isBanned) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-base-950 px-4 text-center">
        <div className="max-w-md space-y-6 rounded-2xl border border-red-500/20 bg-base-900/60 p-8 backdrop-blur-xl shadow-glow-red">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500 animate-pulse" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-red-500">
            Доступ заблокирован
          </h1>
          <p className="text-sm text-slate-300">
            Администратор заблокировал ваш аккаунт{" "}
            {bannedUntil
              ? `до ${new Date(bannedUntil).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "навсегда"}
            .
          </p>
          <Button
            variant="outline"
            className="w-full border-red-500/20 text-slate-300 hover:bg-red-500/10"
            onClick={handleSignOut}
          >
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
