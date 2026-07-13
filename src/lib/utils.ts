import { type ClassValue } from "./cn.types";

/**
 * Tiny classNames joiner — merges conditional class strings.
 * Avoids pulling in an extra dependency for this small need.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) out.push(inner);
    } else if (typeof input === "object") {
      for (const [key, val] of Object.entries(input)) {
        if (val) out.push(key);
      }
    }
  }
  return out.join(" ");
}

/** Relative time like "5m", "3h", "2d" from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/** Considers a user online if seen in the last 2 minutes. */
export function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

/** Derive age from an ISO birth date. */
export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

/** Initials for avatar fallback. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic conversation ordering so (a,b) === (b,a). */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
