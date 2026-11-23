import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type RoomRole = "owner" | "editor" | "commentor" | "viewer";

export const ROOM_ROLES: readonly RoomRole[] = ["owner", "editor", "commentor", "viewer"];

export function canEditRole(role: RoomRole): boolean {
  return role === "owner" || role === "editor";
}

export interface RoomTokenClaims {
  sub: string;
  room: string;
  role: RoomRole;
  name?: string;

  signedIn?: boolean;
}

export interface VerifiedRoomToken extends RoomTokenClaims {
  exp: number;
  iat: number;
}

function secretKey(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("ROOM_TOKEN_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signRoomToken(
  secret: string,
  claims: RoomTokenClaims,
  ttlSeconds: number,
): Promise<string> {
  const payload: JWTPayload = {
    typ: "room",
    room: claims.room,
    role: claims.role,
    name: claims.name,
    signedIn: claims.signedIn === true,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey(secret));
}

export async function verifyRoomToken(secret: string, token: string): Promise<VerifiedRoomToken> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ["HS256"],
  });

  if (payload.typ !== "room") throw new Error("not a room token");
  if (typeof payload.room !== "string" || typeof payload.sub !== "string") {
    throw new Error("malformed room token");
  }
  if (!(ROOM_ROLES as readonly string[]).includes(String(payload.role))) {
    throw new Error("malformed room token role");
  }

  return {
    sub: payload.sub,
    room: payload.room,
    role: payload.role as RoomRole,
    name: typeof payload.name === "string" ? payload.name : undefined,
    signedIn: payload.signedIn === true,
    exp: payload.exp ?? 0,
    iat: payload.iat ?? 0,
  };
}
