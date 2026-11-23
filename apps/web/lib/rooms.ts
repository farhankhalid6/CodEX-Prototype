import { randomBytes, timingSafeEqual } from "node:crypto";
import { canEditRole, type RoomRole } from "@codex/shared";

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export interface RoomRow {
  id: string;
  owner_id: string | null;
  title: string;
  language: string;
  visibility: "public-link" | "private";
  read_only_slug: string;
  content_text: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ROOM_PUBLIC_COLUMNS =
  "id, owner_id, title, language, visibility, content_text, expires_at, created_at, updated_at";

export const ROOM_FULL_COLUMNS = `${ROOM_PUBLIC_COLUMNS}, read_only_slug`;

export function generateRoomId(length = 9): string {
  const bytes = randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length];
  }
  return id;
}

export function generateReadOnlySlug(): string {
  return randomBytes(18).toString("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isExpired(room: Pick<RoomRow, "expires_at">): boolean {
  return room.expires_at !== null && new Date(room.expires_at).getTime() < Date.now();
}

export function resolveAccess(
  room: Pick<RoomRow, "owner_id" | "visibility" | "read_only_slug" | "expires_at">,
  userId: string | null,
  viewKey?: string | null,
): RoomRole | null {
  if (isExpired(room)) return null;

  if (viewKey && room.read_only_slug && safeEqual(viewKey, room.read_only_slug)) {
    return "viewer";
  }

  if (userId && room.owner_id === userId) return "owner";

  if (viewKey) return null;

  if (room.visibility === "public-link") return "editor";

  return null;
}

export function canEdit(role: RoomRole | null): boolean {
  return role !== null && canEditRole(role);
}
