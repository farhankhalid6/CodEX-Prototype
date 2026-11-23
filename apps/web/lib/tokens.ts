import { ROOM_TOKEN_TTL_SECONDS, signRoomToken, type RoomRole } from "@codex/shared";
import { env } from "@/lib/env";

export async function mintRoomToken(
  roomId: string,
  role: RoomRole,
  sub: string,
  name?: string,
  signedIn = false,
): Promise<string> {
  return signRoomToken(
    env("ROOM_TOKEN_SECRET"),
    { sub, room: roomId, role, name, signedIn },
    ROOM_TOKEN_TTL_SECONDS,
  );
}

export { ROOM_TOKEN_TTL_SECONDS };
