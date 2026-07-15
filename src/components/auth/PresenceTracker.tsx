"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** How often we refresh ban status while the tab is open. */
const BAN_CHECK_MS = 60_000;
/** Minimum gap between last_seen writes. */
const PRESENCE_MIN_MS = 60_000;

/**
 * Lightweight presence + ban overlay.
 * Avoids hammering Supabase on every mousemove (previous behaviour).
 */
export function PresenceTracker() {
  const supabase = useMemo(() => createClient(), []);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const lastPresenceRef = useRef(0);
  const lastBanCheckRef = useRef(0);

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

    async function touchPresence(force = false) {
      const userId = await resolveUserId();
      if (!userId || cancelled) return;

      const now = Date.now();
      if (!force && now - lastPresenceRef.current < PRESENCE_MIN_MS) return;
      lastPresenceRef.current = now;

      // Heartbeat RPC only writes if last_seen is stale (>90s) — less thrash.
      const { error } = await supabase.rpc("heartbeat" as never);
      if (error) {
        await (supabase as any)
          .from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", userId);
      }
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

    const banInterval = setInterval(() => void checkBan(), BAN_CHECK_MS);
    const presenceInterval = setInterval(
      () => void touchPresence(),
      PRESENCE_MIN_MS
    );

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void checkBan();
      void touchPresence();
    };

    // Activity only marks "user is here" — presence write is still rate-limited.
    let activityTimer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      if (activityTimer) return;
      activityTimer = setTimeout(() => {
        activityTimer = null;
        void touchPresence();
      }, 5_000);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Sparse activity signals — not mousemove (that fired dozens of times/sec).
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });

    return () => {
      cancelled = true;
      clearInterval(banInterval);
      clearInterval(presenceInterval);
      if (activityTimer) clearTimeout(activityTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
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
