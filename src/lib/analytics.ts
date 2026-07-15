"use client";

import { createClient } from "@/lib/supabase/client";

export type FunnelEvent =
  | "signup_completed"
  | "profile_filled"
  | "first_message_sent"
  | "first_like"
  | "topic_created"
  | "premium_viewed";

/**
 * Fire-and-forget funnel analytics. No-ops if unauthenticated or table missing.
 */
export async function trackEvent(
  event: FunnelEvent | string,
  props: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;
    await supabase.rpc("track_event" as never, {
      p_event: event,
      p_props: props,
    } as never);
  } catch {
    /* ignore */
  }
}

/** Heuristic: profile has enough fields to count as "filled". */
export function isProfileFilled(profile: {
  display_name?: string | null;
  bio?: string | null;
  city?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  interests?: string[] | null;
  avatar_url?: string | null;
}): boolean {
  const hasName = !!(profile.display_name && profile.display_name.trim().length >= 2);
  const hasBio = !!(profile.bio && profile.bio.trim().length >= 20);
  const hasCity = !!profile.city;
  const hasBirth = !!profile.birth_date;
  const hasGender =
    !!profile.gender && profile.gender !== "prefer_not_to_say";
  const hasInterest = (profile.interests?.length ?? 0) > 0;
  const hasAvatar = !!profile.avatar_url;
  const score =
    Number(hasName) +
    Number(hasBio) +
    Number(hasCity) +
    Number(hasBirth) +
    Number(hasGender) +
    Number(hasInterest) +
    Number(hasAvatar);
  return score >= 4;
}
