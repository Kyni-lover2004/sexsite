"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/** Free: 10/day · Premium: 100/day · Admin/own: unlimited */
const FREE_DAILY = 10;
const PREMIUM_DAILY = 100;
const STORAGE_KEY = "photo_views_daily_v2";

type DayBucket = { day: string; photos: string[] };

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadLocal(): DayBucket {
  if (typeof window === "undefined") return { day: utcDay(), photos: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: utcDay(), photos: [] };
    const parsed = JSON.parse(raw) as DayBucket;
    if (parsed.day !== utcDay()) return { day: utcDay(), photos: [] };
    return parsed;
  } catch {
    return { day: utcDay(), photos: [] };
  }
}

function saveLocal(bucket: DayBucket) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
}

function localLimit(isPremium: boolean) {
  return isPremium ? PREMIUM_DAILY : FREE_DAILY;
}

export type PhotoQuota = {
  viewedCount: number;
  limit: number | null;
  unlimited: boolean;
  tier: string;
  limitReached: boolean;
  remaining: number;
  recordView: (photoId: string) => Promise<boolean>;
};

/**
 * Daily photo open quota for viewing someone else's gallery.
 * Server-backed; localStorage fallback.
 */
export function usePhotoViewLimit(
  profileId: string | null,
  opts: {
    /** Own profile / already known admin — skip entirely */
    skip?: boolean;
    /** Used only for local fallback when RPC missing */
    viewerIsPremium?: boolean;
  } = {}
): PhotoQuota {
  const { skip = false, viewerIsPremium = false } = opts;
  const supabase = useMemo(() => createClient(), []);
  const [viewedCount, setViewedCount] = useState(0);
  const [limit, setLimit] = useState<number | null>(
    skip ? null : localLimit(viewerIsPremium)
  );
  const [unlimited, setUnlimited] = useState(skip);
  const [tier, setTier] = useState(skip ? "own" : "free");
  const [limitReached, setLimitReached] = useState(false);
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (skip || !profileId) {
      setUnlimited(true);
      setLimit(null);
      setLimitReached(false);
      setViewedCount(0);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc(
        "count_gallery_photo_views" as never,
        { p_profile_id: profileId } as never
      );

      if (cancelled) return;

      if (error) {
        setServerReady(false);
        const bucket = loadLocal();
        const lim = localLimit(viewerIsPremium);
        setViewedCount(bucket.photos.length);
        setLimit(lim);
        setUnlimited(false);
        setTier(viewerIsPremium ? "premium" : "free");
        setLimitReached(bucket.photos.length >= lim);
        return;
      }

      setServerReady(true);
      const payload = data as {
        count?: number;
        limit?: number | null;
        unlimited?: boolean;
        tier?: string;
      } | null;

      if (payload?.unlimited || payload?.limit == null) {
        setUnlimited(true);
        setLimit(null);
        setLimitReached(false);
        setViewedCount(0);
        setTier(payload?.tier ?? "admin");
        return;
      }

      const count = payload.count ?? 0;
      const lim = payload.limit ?? FREE_DAILY;
      setUnlimited(false);
      setViewedCount(count);
      setLimit(lim);
      setTier(payload.tier ?? "free");
      setLimitReached(count >= lim);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, skip, viewerIsPremium, supabase]);

  const recordView = useCallback(
    async (photoId: string): Promise<boolean> => {
      if (skip || unlimited || !profileId) return true;

      if (serverReady !== false) {
        const { data, error } = await supabase.rpc(
          "record_gallery_photo_view" as never,
          {
            p_photo_id: photoId,
            p_profile_id: profileId,
          } as never
        );

        if (!error && data) {
          setServerReady(true);
          const payload = data as {
            allowed?: boolean;
            count?: number;
            limit?: number | null;
            unlimited?: boolean;
            tier?: string;
          };

          if (payload.unlimited || payload.limit == null) {
            setUnlimited(true);
            setLimitReached(false);
            return true;
          }

          const count = payload.count ?? 0;
          const lim = payload.limit ?? FREE_DAILY;
          setViewedCount(count);
          setLimit(lim);
          setTier(payload.tier ?? tier);
          setLimitReached(!payload.allowed || count >= lim);
          return !!payload.allowed;
        }
        setServerReady(false);
      }

      // Local daily fallback
      const bucket = loadLocal();
      const lim = localLimit(viewerIsPremium);
      if (bucket.photos.includes(photoId)) {
        setViewedCount(bucket.photos.length);
        setLimit(lim);
        return true;
      }
      if (bucket.photos.length >= lim) {
        setLimitReached(true);
        setViewedCount(bucket.photos.length);
        setLimit(lim);
        return false;
      }
      bucket.photos.push(photoId);
      saveLocal(bucket);
      setViewedCount(bucket.photos.length);
      setLimit(lim);
      setLimitReached(bucket.photos.length >= lim);
      return true;
    },
    [skip, unlimited, profileId, serverReady, supabase, viewerIsPremium, tier]
  );

  const effectiveLimit = unlimited ? null : limit;
  const remaining =
    effectiveLimit == null
      ? Infinity
      : Math.max(0, effectiveLimit - viewedCount);

  return {
    viewedCount,
    limit: effectiveLimit,
    unlimited,
    tier,
    limitReached: unlimited ? false : limitReached,
    remaining: remaining === Infinity ? 999 : remaining,
    recordView,
  };
}
