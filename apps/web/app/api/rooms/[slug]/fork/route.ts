import { forkRoomSchema } from "@codex/shared";
import { authenticateRoomRequest } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { fail, json, parseJson } from "@/lib/http";
import { getRoomBySlug } from "@/lib/room-queries";
import { generateReadOnlySlug, generateRoomId } from "@/lib/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  const user = await getCurrentUser();
  if (!user) return fail("Sign in to fork a room", 401);

  const source = await getRoomBySlug(slug);
  if (!source) return fail("Room not found", 404);

  const actor = await authenticateRoomRequest(request, source);
  if (!actor) return fail("Not allowed", 403);

  const parsed = await parseJson(request, forkRoomSchema);
  if (!parsed.ok) return parsed.response;

  const admin = supabaseAdmin();

  const { data: stateRows, error: stateError } = await admin.rpc("get_room_state", {
    p_room: slug,
  });
  if (stateError) return fail(stateError.message, 500);

  const stateRow = (Array.isArray(stateRows) ? stateRows[0] : stateRows) as
    { state_b64: string | null; content_text: string; language: string } | undefined;

  if (!stateRow) return fail("Room not found", 404);

  const id = generateRoomId();
  const title = parsed.data.title ?? `Copy of ${source.title}`.slice(0, 120);

  const { error: createError } = await admin.from("rooms").insert({
    id,
    owner_id: user.id,
    title,
    language: source.language,
    visibility: "public-link",
    read_only_slug: generateReadOnlySlug(),
    expires_at: null,
    content_text: stateRow.content_text ?? "",
  });

  if (createError) return fail(createError.message, 500);

  if (stateRow.state_b64) {
    const { error: saveError } = await admin.rpc("save_room_state", {
      p_room: id,
      p_state_b64: stateRow.state_b64,
      p_content: stateRow.content_text ?? "",
      p_language: source.language,
    });

    if (saveError) {
      await admin.from("rooms").delete().eq("id", id);
      return fail(saveError.message, 500);
    }
  }

  return json({ ok: true, slug: id }, { status: 201 });
}
