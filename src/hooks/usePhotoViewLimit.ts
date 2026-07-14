"use client";

import { useState, useCallback, useEffect } from "react";

const PHOTO_VIEW_LIMIT = 10;
const STORAGE_KEY = "photo_views";

interface PhotoViews {
  [userId: string]: string[];
}

function loadViews(): PhotoViews {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveViews(views: PhotoViews) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {}
}

export function usePhotoViewLimit(userId: string | null, isPremium: boolean) {
  const [viewedCount, setViewedCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (!userId || isPremium) return;
    const views = loadViews();
    const viewed = views[userId] ?? [];
    setViewedCount(viewed.length);
    setLimitReached(viewed.length >= PHOTO_VIEW_LIMIT);
  }, [userId, isPremium]);

  const recordView = useCallback(
    (photoId: string) => {
      if (isPremium || !userId) return true;

      const views = loadViews();
      const userViews = views[userId] ?? [];

      if (userViews.includes(photoId)) return true;
      if (userViews.length >= PHOTO_VIEW_LIMIT) {
        setLimitReached(true);
        return false;
      }

      userViews.push(photoId);
      views[userId] = userViews;
      saveViews(views);
      setViewedCount(userViews.length);
      return true;
    },
    [userId, isPremium]
  );

  const resetViews = useCallback(() => {
    if (!userId) return;
    const views = loadViews();
    views[userId] = [];
    saveViews(views);
    setViewedCount(0);
    setLimitReached(false);
  }, [userId]);

  return {
    viewedCount,
    limit: PHOTO_VIEW_LIMIT,
    limitReached,
    remaining: Math.max(0, PHOTO_VIEW_LIMIT - viewedCount),
    recordView,
    resetViews,
  };
}
