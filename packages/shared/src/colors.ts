import { PRESENCE_COLORS } from "./constants.js";

export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function colorForId(id: string): string {
  return PRESENCE_COLORS[hashString(id) % PRESENCE_COLORS.length]!;
}

export function guestName(id: string): string {
  const suffix = hashString(id).toString(36).slice(0, 4).padStart(4, "0");
  return `Guest-${suffix}`;
}

export function slugify(input: string, fallback = "snippet"): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}
