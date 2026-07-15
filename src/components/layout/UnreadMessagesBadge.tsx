"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Unread inbound chat messages count (like NewGuestsBadge).
 */
export function UnreadMessagesBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    if (!uid) {
      setCount(0);
      return;
    }

    // Prefer RPC if migrated
    const rpc = await (supabase as any).rpc("count_unread_messages");
    if (!rpc.error && typeof rpc.data === "number") {
      setCount(rpc.data);
      return;
    }

    // Fallback: count messages not from me with read_at null
    // (RLS should scope to my conversations)
    const { count: c, error } = await (supabase as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", uid);

    if (error) {
      setCount(0);
      return;
    }
    setCount(typeof c === "number" ? c : 0);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      channel = supabase
        .channel(`unread-msgs:${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => void refresh()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          () => void refresh()
        )
        .subscribe();
    })();

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      if (channel) {
        const supabase = createClient();
        void supabase.removeChannel(channel);
      }
    };
  }, [refresh]);

  // On chat pages messages get marked read — clear optimistically
  useEffect(() => {
    if (pathname === "/chat" || pathname.startsWith("/chat/")) {
      // Soft refresh after a tick so server marks can land
      const t = window.setTimeout(() => void refresh(), 800);
      return () => window.clearTimeout(t);
    }
  }, [pathname, refresh]);

  if (count <= 0) return null;

  const label = count > 9 ? "9+" : String(count);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-gold-gradient font-bold text-white shadow-neon-gold",
        compact
          ? "absolute -right-1 -top-0.5 h-4 min-w-4 px-1 text-[9px] leading-none"
          : "ml-auto h-5 min-w-5 px-1.5 text-[10px] leading-none",
        className
      )}
      aria-label={`${count} непрочитанных сообщений`}
    >
      {label}
    </span>
  );
}
