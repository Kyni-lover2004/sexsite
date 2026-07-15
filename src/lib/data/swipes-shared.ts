/** Client-safe swipe types & filter storage. */

import type { Profile } from "@/lib/types";

export const SWIPE_FILTERS_KEY = "dp_swipe_filters_v1";

export type SwipeFilters = {
  gender: string;
  country: string;
  region: string;
  city: string;
  minAge: string;
  maxAge: string;
  datingGoals: string[];
};

export const DEFAULT_SWIPE_FILTERS: SwipeFilters = {
  gender: "",
  country: "",
  region: "",
  city: "",
  minAge: "",
  maxAge: "",
  datingGoals: [],
};

export type SwipePhoto = {
  id: string;
  url: string;
  sort_order: number;
};

export type SwipeCard = Profile & {
  photos: SwipePhoto[];
  /** They liked you already */
  likedMe?: boolean;
  /** They superliked you */
  superlikedMe?: boolean;
  iLiked?: boolean;
  isMutual?: boolean;
  is_superlike?: boolean;
};

export type SwipeAction = "like" | "pass" | "superlike";

export type SwipeActionResult = {
  ok: boolean;
  action?: SwipeAction;
  mutual?: boolean;
  is_superlike?: boolean;
  error?: string;
};

export type ReceivedLike = {
  from_id: string;
  is_superlike: boolean;
  created_at: string;
  is_mutual: boolean;
  profile: Profile | null;
  photos: SwipePhoto[];
};

export function loadSwipeFilters(): SwipeFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SWIPE_FILTERS_KEY);
    if (!raw) return null;
    return { ...DEFAULT_SWIPE_FILTERS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function saveSwipeFilters(filters: SwipeFilters) {
  try {
    sessionStorage.setItem(SWIPE_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export function clearSwipeFilters() {
  try {
    sessionStorage.removeItem(SWIPE_FILTERS_KEY);
  } catch {
    /* ignore */
  }
}
