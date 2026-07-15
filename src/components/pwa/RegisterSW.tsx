"use client";

import { useEffect } from "react";

/** Registers the lightweight service worker for PWA installability. */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Avoid SW in local dev noise unless production-like
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  }, []);

  return null;
}
