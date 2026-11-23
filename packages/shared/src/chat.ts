import { CHAT_KEEP_PER_ROOM, CHAT_MESSAGE_MAX_CHARS } from "./constants.js";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

export const MESSAGE_CHAT = 4;

export interface ChatEntry {
  id: string;
  name: string;
  text: string;
  at: string;
}

export type ChatPayload =
  { kind: "message"; entry: ChatEntry } | { kind: "history"; messages: ChatEntry[] };

export function encodeChat(payload: ChatPayload): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_CHAT);
  encoding.writeVarString(encoder, JSON.stringify(payload));
  return encoding.toUint8Array(encoder);
}

function validEntry(value: unknown): value is ChatEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length <= 64 &&
    typeof entry.name === "string" &&
    entry.name.length <= 40 &&
    typeof entry.text === "string" &&
    entry.text.length > 0 &&
    entry.text.length <= CHAT_MESSAGE_MAX_CHARS &&
    typeof entry.at === "string" &&
    entry.at.length <= 40
  );
}

export function decodeChat(data: Uint8Array): ChatPayload | null {
  try {
    const decoder = decoding.createDecoder(data);
    if (decoding.readVarUint(decoder) !== MESSAGE_CHAT) return null;

    const parsed = JSON.parse(decoding.readVarString(decoder)) as Record<string, unknown>;
    if (parsed?.kind === "message" && validEntry(parsed.entry)) {
      return { kind: "message", entry: parsed.entry };
    }
    if (
      parsed?.kind === "history" &&
      Array.isArray(parsed.messages) &&
      parsed.messages.length <= CHAT_KEEP_PER_ROOM &&
      parsed.messages.every(validEntry)
    ) {
      return { kind: "history", messages: parsed.messages };
    }
    return null;
  } catch {
    return null;
  }
}

export function isChatMessage(data: Uint8Array): boolean {
  return data.length > 0 && data[0] === MESSAGE_CHAT;
}
