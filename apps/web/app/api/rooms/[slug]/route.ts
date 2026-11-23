import { updateRoomSchema } from "@codex/shared";
import { getCurrentUser } from "@/lib/auth";
import { fail, json, parseJson } from "@/lib/http";
import { getRoomBySlug } from "@/lib/room-queries";
import { isExpired, resolveAccess } from "@/lib/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const room = await getRoomBySlug(slug);
  if (!room) return fail("Room not found", 404);

  const url = new URL(request.url);
  const viewKey = url.searchParams.get("view");
  const user = await getCurrentUser();
  const role = resolveAccess(room, user?.id ?? null, viewKey);

  if (!role) {
    return fail(
      isExpired(room) ? "This room has expired" : "You do not have access",
      isExpired(room) ? 410 : 403,
    );
  }

  return json({
    ok: true,
    room: {
      slug: room.id,
      title: room.title,
      language: room.language,
      visibility: room.visibility,
      expiresAt: room.expires_at,
      updatedAt: room.updated_at,
      ownerId: room.owner_id,
    },
    role,
    readOnlySlug: role === "viewer" ? null : room.read_only_slug,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const user = await getCurrentUser();
  if (!user) return fail("Sign in required", 401);

  const room = await getRoomBySlug(slug);
  if (!room) return fail("Room not found", 404);
  if (room.owner_id !== user.id) return fail("Only the owner can change room settings", 403);

  const parsed = await parseJson(request, updateRoomSchema);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .update(parsed.data)
    .eq("id", slug)
    .select("id, title, language, visibility, updated_at")
    .single();

  if (error) return fail(error.message, 500);
  return json({ ok: true, room: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const user = await getCurrentUser();
  if (!user) return fail("Sign in required", 401);

  const room = await getRoomBySlug(slug);
  if (!room) return fail("Room not found", 404);
  if (room.owner_id !== user.id) return fail("Only the owner can delete this room", 403);

  const { error } = await supabaseAdmin().from("rooms").delete().eq("id", slug);
  if (error) return fail(error.message, 500);

  return json({ ok: true });
}
