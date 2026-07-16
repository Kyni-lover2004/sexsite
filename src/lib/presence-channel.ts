/**
 * Instant presence over Supabase Realtime Broadcast.
 * Does NOT require profiles in supabase_realtime publication.
 * Invisible users must stop broadcasting and emit offline once.
 */

export const PRESENCE_EVENT = "presence";

export type PresenceBroadcastPayload = {
  userId: string;
  /** false = went offline or enabled invisible */
  online: boolean;
  invisible?: boolean;
  at: string; // ISO
};

export function presenceChannelName(userId: string): string {
  return `presence-live:${userId}`;
}
