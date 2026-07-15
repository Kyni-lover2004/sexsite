"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const PHOTO_VIEW_LIMIT = 10;
/** Local fallback if server RPC is not migrated yet. */
const STORAGE_KEY = "photo_views";

interface PhotoViews {
  [profileId: string]: string[];
}

function loadLocal(): PhotoViews {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal(views: PhotoViews) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}

/**
 * Free viewers: max 10 unique photos per target profile (server-backed).
 * Premium viewers / own profile: unlimited.
 * Falls back to localStorage if RPC missing.
 */
export function usePhotoViewLimit(
  profileId: string | null,
  viewerIsPremium: boolean
) {
  const supabase = useMemo(() => createClient(), []);
  const [viewedCount, setViewedCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profileId || viewerIsPremium) {
      setViewedCount(0);
      setLimitReached(false);
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
        const views = loadLocal();
        const viewed = views[profileId] ?? [];
        setViewedCount(viewed.length);
        setLimitReached(viewed.length >= PHOTO_VIEW_LIMIT);
        return;
      }

      setServerReady(true);
      const payload = data as {
        count?: number;
        limit?: number | null;
        premium?: boolean;
      } | null;
      if (payload?.premium) {
        setViewedCount(0);
        setLimitReached(false);
        return;
      }
      const count = payload?.count ?? 0;
      const limit = payload?.limit ?? PHOTO_VIEW_LIMIT;
      setViewedCount(count);
      setLimitReached(count >= (limit ?? PHOTO_VIEW_LIMIT));
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, viewerIsPremium, supabase]);

  const recordView = useCallback(
    async (photoId: string): Promise<boolean> => {
      if (viewerIsPremium || !profileId) return true;

      // Server path
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
            premium?: boolean;
          };
          if (payload.premium) {
            setLimitReached(false);
            return true;
          }
          const count = payload.count ?? 0;
          const limit = payload.limit ?? PHOTO_VIEW_LIMIT;
          setViewedCount(count);
          setLimitReached(!payload.allowed || count >= limit);
          return !!payload.allowed;
        }
        setServerReady(false);
      }

      // Local fallback
      const views = loadLocal();
      const userViews = views[profileId] ?? [];
      if (userViews.includes(photoId)) return true;
      if (userViews.length >= PHOTO_VIEW_LIMIT) {
        setLimitReached(true);
        return false;
      }
      userViews.push(photoId);
      views[profileId] = userViews;
      saveLocal(views);
      setViewedCount(userViews.length);
      return true;
    },
    [profileId, viewerIsPremium, serverReady, supabase]
  );

  const resetViews = useCallback(() => {
    if (!profileId) return;
    const views = loadLocal();
    views[profileId] = [];
    saveLocal(views);
    setViewedCount(0);
    setLimitReached(false);
  }, [profileId]);

  return {
    viewedCount,
    limit: PHOTO_VIEW_LIMIT,
    limitReached: viewerIsPremium ? false : limitReached,
    remaining: Math.max(0, PHOTO_VIEW_LIMIT - viewedCount),
    recordView,
    resetViews,
  };
}
