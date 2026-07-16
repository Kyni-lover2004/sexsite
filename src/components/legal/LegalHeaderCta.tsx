"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * «Войти» for guests, «В приложение» when already authenticated.
 */
export function LegalHeaderCta() {
  const [state, setState] = useState<"loading" | "guest" | "user">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setState(data.session?.user ? "user" : "guest");
      } catch {
        if (!cancelled) setState("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <span className="text-xs text-slate-600">…</span>;
  }

  if (state === "user") {
    return (
      <Link
        href="/"
        className="text-xs font-medium text-gold-soft hover:underline"
      >
        В приложение
      </Link>
    );
  }

  return (
    <Link href="/login" className="text-xs text-gold-soft hover:underline">
      Войти
    </Link>
  );
}
