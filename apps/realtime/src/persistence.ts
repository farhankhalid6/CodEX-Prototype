import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

export interface StoredRoom {
  state: Uint8Array | null;
  contentText: string;
  language: string;
  visibility: "public-link" | "private";
  ownerId: string | null;
  expiresAt: Date | null;
}

interface RoomStateRow {
  state_b64: string | null;
  content_text: string | null;
  language: string | null;
  visibility: string | null;
  owner_id: string | null;
  expires_at: string | null;
}

export class RoomStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async load(roomId: string): Promise<StoredRoom | null> {
    const { data, error } = await this.supabase.rpc("get_room_state", {
      p_room: roomId,
    });

    if (error) {
      throw new Error(`get_room_state failed: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as RoomStateRow | undefined;
    if (!row) return null;

    return {
      state: row.state_b64 ? new Uint8Array(Buffer.from(row.state_b64, "base64")) : null,
      contentText: row.content_text ?? "",
      language: row.language ?? "plaintext",
      visibility: row.visibility === "private" ? "private" : "public-link",
      ownerId: row.owner_id,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    };
  }

  async save(
    roomId: string,
    state: Uint8Array,
    contentText: string,
    language: string,
  ): Promise<void> {
    const { error } = await this.supabase.rpc("save_room_state", {
      p_room: roomId,
      p_state_b64: Buffer.from(state).toString("base64"),
      p_content: contentText,
      p_language: language,
    });

    if (error) {
      throw new Error(`save_room_state failed: ${error.message}`);
    }

    logger.debug("room saved", { room: roomId, bytes: state.byteLength });
  }
}
