"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Live count of guests since the user last opened /guests.
 * Polls lightly so badges stay fresh without hammering the API.
 */
export function NewGuestsBadge({
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
    if (!session.session?.user) {
      setCount(0);
      return;
    }
    const { data, error } = await (supabase as any).rpc("count_new_guests");
    if (error) {
      // Column/function may not be migrated yet — fail silent.
      setCount(0);
      return;
    }
    setCount(typeof data === "number" ? data : 0);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // After visiting /guests the server marks seen — zero out optimistically.
  useEffect(() => {
    if (pathname === "/guests" || pathname.startsWith("/guests/")) {
      setCount(0);
    }
  }, [pathname]);

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
      aria-label={`${count} новых гостей`}
    >
      {label}
    </span>
  );
}
