import { SignJWT, jwtVerify } from "jose";
import { ROOM_ACCESS_LEVELS, SHARE_TOKEN_TTL_SECONDS, type RoomAccessLevel } from "./constants.js";

export interface ShareTokenClaims {
  room: string;
  role: RoomAccessLevel;
}

function secretKey(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("ROOM_TOKEN_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signShareToken(
  secret: string,
  claims: ShareTokenClaims,
  ttlSeconds: number = SHARE_TOKEN_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ typ: "share", room: claims.room, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey(secret));
}

export async function verifyShareToken(secret: string, token: string): Promise<ShareTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });

  if (payload.typ !== "share") throw new Error("not a share token");
  if (typeof payload.room !== "string") throw new Error("malformed share token");
  if (!(ROOM_ACCESS_LEVELS as readonly string[]).includes(String(payload.role))) {
    throw new Error("malformed share token role");
  }

  return { room: payload.room, role: payload.role as RoomAccessLevel };
}
