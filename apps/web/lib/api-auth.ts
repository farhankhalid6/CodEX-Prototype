import { verifyRoomToken, type RoomRole } from "@codex/shared";
import { getCurrentUser, getUserFromBearer } from "@/lib/auth";
import { env } from "@/lib/env";
import { resolveAccess, type RoomRow } from "@/lib/rooms";

export interface RoomActor {
  sub: string;
  role: RoomRole;
  userId: string | null;
}

export async function authenticateRoomRequest(
  request: Request,
  room: Pick<RoomRow, "id" | "owner_id" | "visibility" | "read_only_slug" | "expires_at">,
): Promise<RoomActor | null> {
  const header = request.headers.get("authorization");

  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();

    try {
      const claims = await verifyRoomToken(env("ROOM_TOKEN_SECRET"), token);
      if (claims.room === room.id) {
        return { sub: claims.sub, role: claims.role, userId: null };
      }
    } catch {}

    const user = await getUserFromBearer(token);
    if (user) {
      const role = resolveAccess(room, user.id, null);
      if (role) return { sub: user.id, role, userId: user.id };
    }
  }

  const user = await getCurrentUser();
  if (user) {
    const role = resolveAccess(room, user.id, null);
    if (role) return { sub: user.id, role, userId: user.id };
  }

  return null;
}
