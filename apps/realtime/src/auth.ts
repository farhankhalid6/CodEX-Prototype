import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyRoomToken, type RoomRole } from "@codex/shared";
import type { Config } from "./config.js";
import { logger } from "./logger.js";

export interface Principal {
  sub: string;
  role: RoomRole;
  name?: string;

  signedIn: boolean;
}

interface CachedUser {
  id: string;
  expiresAt: number;
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_CACHE_MAX = 1_000;

export class Authenticator {
  private readonly userCache = new Map<string, CachedUser>();

  constructor(
    private readonly config: Config,
    private readonly supabase: SupabaseClient,
  ) {}

  async authenticate(token: string, roomId: string): Promise<Principal | null> {
    if (!token || token.length > 4096) return null;

    try {
      const claims = await verifyRoomToken(this.config.roomTokenSecret, token);
      if (claims.room !== roomId) return null;
      return {
        sub: claims.sub,
        role: claims.role,
        name: claims.name,
        signedIn: claims.signedIn === true,
      };
    } catch {}

    const userId = await this.resolveSupabaseUser(token);
    if (!userId) return null;

    const { data, error } = await this.supabase
      .from("rooms")
      .select("owner_id, visibility")
      .eq("id", roomId)
      .maybeSingle();

    if (error || !data) return null;

    if (data.owner_id && data.owner_id === userId) {
      return { sub: userId, role: "owner", signedIn: true };
    }
    if (data.visibility === "public-link") {
      return { sub: userId, role: "editor", signedIn: true };
    }

    logger.debug("rejected supabase user for private room", { room: roomId, userId });
    return null;
  }

  private async resolveSupabaseUser(token: string): Promise<string | null> {
    const cached = this.userCache.get(token);
    if (cached && cached.expiresAt > Date.now()) return cached.id;

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;

    if (this.userCache.size >= USER_CACHE_MAX) {
      const oldest = this.userCache.keys().next().value;
      if (oldest) this.userCache.delete(oldest);
    }
    this.userCache.set(token, {
      id: data.user.id,
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });

    return data.user.id;
  }
}
