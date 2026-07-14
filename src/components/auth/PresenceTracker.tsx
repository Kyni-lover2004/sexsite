"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Global presence tracker component.
 * Periodically updates the current user's `last_seen` timestamp in the database
 * while they are active on the site, throttled to prevent database spam.
 */
export function PresenceTracker() {
  const supabase = createClient();

  useEffect(() => {
    let lastUpdated = 0;
    const UPDATE_INTERVAL = 45000; // 45 seconds (since isOnline considers a user online if active in last 2 mins)

    async function updateLastSeen() {
      const now = Date.now();
      // Throttle updates
      if (now - lastUpdated < UPDATE_INTERVAL) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      lastUpdated = now;
      await (supabase as any)
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }

    // Update on initial load
    updateLastSeen();

    // Update periodically
    const interval = setInterval(updateLastSeen, UPDATE_INTERVAL);

    // Update on user activity (throttled by the check inside updateLastSeen)
    const handleActivity = () => {
      if (document.visibilityState === "visible") {
        updateLastSeen();
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

  return null;
}
