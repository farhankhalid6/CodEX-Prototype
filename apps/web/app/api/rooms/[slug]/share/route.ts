import {
  SHARE_TOKEN_TTL_SECONDS,
  canEditRole,
  shareRequestSchema,
  signShareToken,
} from "@codex/shared";
import { authenticateRoomRequest } from "@/lib/api-auth";
import { env } from "@/lib/env";
import { fail, json, parseJson } from "@/lib/http";
import { getRoomBySlug } from "@/lib/room-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const room = await getRoomBySlug(slug);
  if (!room) return fail("Room not found", 404);

  const actor = await authenticateRoomRequest(request, room);
  if (!actor) return fail("You do not have access to this room", 403);
  if (!canEditRole(actor.role)) {
    return fail("Only editors and owners can share access links", 403);
  }

  const parsed = await parseJson(request, shareRequestSchema);
  if (!parsed.ok) return parsed.response;

  const token = await signShareToken(env("ROOM_TOKEN_SECRET"), {
    room: room.id,
    role: parsed.data.access,
  });

  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    url: `${origin}/r/${room.id}?access=${encodeURIComponent(token)}`,
    access: parsed.data.access,
    expiresIn: SHARE_TOKEN_TTL_SECONDS,
  });
}
