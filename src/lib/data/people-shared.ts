/** Shared people constants (safe for client + server). */

import type { Profile } from "@/lib/types";

/** Like from People search (not swipe deck). */
export const LIKE_SOURCE_PEOPLE = "people";
/** Like from Swipe deck. */
export const LIKE_SOURCE_SWIPE = "swipe";

export const PEOPLE_SELECT =
  "id, username, display_name, avatar_url, status, bio, interests, dating_goal, dating_goals, country, region, city, birth_date, gender, available_for_chat, last_seen, role, premium_until, looking_for, created_at";

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export type PeopleTab = "nearby" | "online" | "available" | "mutual" | "all";

export type PeopleCard = Profile & {
  iLiked?: boolean;
  likedMe?: boolean;
  isMutual?: boolean;
};

export type PeopleSearchFilters = {
  tab?: PeopleTab;
  query?: string;
  gender?: string;
  country?: string;
  region?: string;
  city?: string;
  interests?: string[];
  datingGoals?: string[];
  minAge?: number | null;
  maxAge?: number | null;
  limit?: number;
};

export function birthDateBounds(minAge?: number | null, maxAge?: number | null) {
  const now = new Date();
  let maxBirth: string | null = null;
  let minBirth: string | null = null;
  if (minAge != null && !Number.isNaN(minAge)) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - minAge);
    maxBirth = d.toISOString().slice(0, 10);
  }
  if (maxAge != null && !Number.isNaN(maxAge)) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - maxAge - 1);
    d.setDate(d.getDate() + 1);
    minBirth = d.toISOString().slice(0, 10);
  }
  return { minBirth, maxBirth };
}
