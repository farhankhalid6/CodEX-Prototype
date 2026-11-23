import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyShareToken, type RoomRole } from "@codex/shared";
import { displayNameFor, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { fail, json, parseJson } from "@/lib/http";
import { getRoomBySlug } from "@/lib/room-queries";
import { isExpired, resolveAccess } from "@/lib/rooms";
import { mintRoomToken, ROOM_TOKEN_TTL_SECONDS } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenRequestSchema = z.object({
  clientId: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  viewKey: z.string().min(8).max(128).optional(),
  shareToken: z.string().min(20).max(4096).optional(),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const room = await getRoomBySlug(slug);
  if (!room) return fail("Room not found", 404);

  const parsed = await parseJson(request, tokenRequestSchema);
  if (!parsed.ok) return parsed.response;

  const url = new URL(request.url);
  const viewKey = parsed.data.viewKey ?? url.searchParams.get("view");
  const shareToken = parsed.data.shareToken ?? url.searchParams.get("access");
  const user = await getCurrentUser();
  const sessionRole = resolveAccess(room, user?.id ?? null, viewKey);

  let role: RoomRole | null = null;

  if (sessionRole === "owner") {
    role = "owner";
  } else if (sessionRole === "viewer") {
    role = "viewer";
  } else if (shareToken) {
    try {
      const claims = await verifyShareToken(env("ROOM_TOKEN_SECRET"), shareToken);
      if (claims.room !== room.id) throw new Error("wrong room");
      role = claims.role;
    } catch {
      return fail("This share link is invalid or has expired", 403);
    }
  } else {
    role = sessionRole;
  }

  if (!role) {
    return fail(
      isExpired(room) ? "This room has expired" : "You do not have access to this room",
      isExpired(room) ? 410 : 403,
    );
  }

  const sub = user?.id ?? parsed.data.clientId ?? randomUUID();
  const name = parsed.data.displayName ?? (await displayNameFor(user)) ?? undefined;
  // The realtime server reads this claim as its chat capability flag. In the
  // prototype, every valid room participant can chat, including anonymous link
  // holders. It is not an email or account verification claim.
  const token = await mintRoomToken(room.id, role, sub, name, true);

  return json({
    ok: true,
    token,
    role,
    expiresIn: ROOM_TOKEN_TTL_SECONDS,
    readOnlySlug: role === "viewer" ? null : room.read_only_slug,
    room: {
      slug: room.id,
      title: room.title,
      language: room.language,
      visibility: room.visibility,
      expiresAt: room.expires_at,
    },
  });
}
