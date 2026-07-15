/**
 * Light tactile feedback on supported mobile browsers (iOS Safari, Android Chrome).
 * No-ops silently when Vibration API is unavailable.
 */
export type HapticKind = "light" | "medium" | "success" | "warning" | "selection";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  selection: 6,
  success: [10, 40, 12],
  warning: [20, 30, 20],
};

export function haptic(kind: HapticKind = "light"): void {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}
