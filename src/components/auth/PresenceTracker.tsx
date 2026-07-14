"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Global presence tracker component.
 * Periodically updates the current user's `last_seen` timestamp in the database
 * while they are active on the site, and checks if the user is banned.
 */
export function PresenceTracker() {
  const supabase = createClient();
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);

  useEffect(() => {
    let lastUpdated = 0;
    const UPDATE_INTERVAL = 30000; // Check and update every 30 seconds

    async function checkBanAndPresence() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsBanned(false);
        return;
      }

      // 1. Fetch ban status
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("is_banned, banned_until")
        .eq("id", user.id)
        .single();

      if (profile) {
        const isBannedActive = profile.is_banned && (
          !profile.banned_until || new Date(profile.banned_until) > new Date()
        );
        setIsBanned(isBannedActive);
        setBannedUntil(profile.banned_until);

        if (isBannedActive) {
          return; // Skip presence update if banned
        }
      }

      // 2. Throttle presence updates
      const now = Date.now();
      if (now - lastUpdated < 45000) return;

      lastUpdated = now;
      await (supabase as any)
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }

    // Run check on initial load
    checkBanAndPresence();

    // Check periodically
    const interval = setInterval(checkBanAndPresence, UPDATE_INTERVAL);

    // Check on user activity
    const handleActivity = () => {
      if (document.visibilityState === "visible") {
        checkBanAndPresence();
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
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
