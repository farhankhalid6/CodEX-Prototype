import { createRoomSchema } from "@codex/shared";
import { displayNameFor, getCurrentUser } from "@/lib/auth";
import { fail, hashIp, clientIp, json, parseJson } from "@/lib/http";
import { checkRoomCreateLimit } from "@/lib/rate-limit";
import { generateReadOnlySlug, generateRoomId } from "@/lib/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const parsed = await parseJson(request, createRoomSchema);
  if (!parsed.ok) return parsed.response;

  const input = parsed.data;
  const ipHash = hashIp(clientIp(request));

  if (!(await checkRoomCreateLimit(ipHash))) {
    return fail("Too many rooms created from this address. Try again later.", 429);
  }

  const user = await getCurrentUser();
  const displayName = await displayNameFor(user);

  const expiresInDays = user ? input.expiresInDays : (input.expiresInDays ?? 7);
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + Math.max(1, expiresInDays) * DAY_MS).toISOString();
  const visibility = user ? input.visibility : "public-link";

  const admin = supabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = generateRoomId();
    const readOnlySlug = generateReadOnlySlug();

    const { error } = await admin.from("rooms").insert({
      id,
      owner_id: user?.id ?? null,
      title: input.title,
      language: input.language,
      visibility,
      read_only_slug: readOnlySlug,
      expires_at: expiresAt,
      created_ip_hash: ipHash,
      content_text: "",
    });

    if (!error) {
      return json(
        {
          ok: true,
          slug: id,
          url: `${siteUrl()}/r/${id}`,
          readOnlySlug,
          expiresAt,
          displayName: input.displayName ?? displayName ?? null,
        },
        { status: 201 },
      );
    }

    if (error.code !== "23505") {
      return fail(`Could not create room: ${error.message}`, 500);
    }
  }

  return fail("Could not allocate a room id. Please retry.", 500);
}
