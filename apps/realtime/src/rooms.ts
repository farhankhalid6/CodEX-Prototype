import { WebSocket, type RawData } from "ws";
import * as Y from "yjs";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import {
  CHAT_KEEP_PER_ROOM,
  Y_META_KEY,
  Y_TEXT_KEY,
  canEditRole,
  decodeChat,
  encodeChat,
  isChatMessage,
  type ChatEntry,
  type RoomRole,
} from "@codex/shared";
import type { Config } from "./config.js";
import type { Principal } from "./auth.js";
import { logger } from "./logger.js";
import type { RoomStore, StoredRoom } from "./persistence.js";
import {
  encodeAwareness,
  encodeSyncStep1,
  encodeUpdate,
  handleMessage,
  isDocumentUpdate,
} from "./protocol.js";

const HEARTBEAT_MS = 30_000;
const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 300;

interface ConnInfo {
  id: string;
  role: RoomRole;
  name?: string;
  readOnly: boolean;
  signedIn: boolean;
  ws: WebSocket;
  isAlive: boolean;
  windowStart: number;
  messageCount: number;
  awarenessIds: Set<number>;
}

export interface Room {
  id: string;
  doc: Y.Doc;
  text: Y.Text;
  meta: Y.Map<unknown>;
  awareness: Awareness;
  conns: Map<WebSocket, ConnInfo>;

  chat: ChatEntry[];
  expiresAt: number | null;
  dirty: boolean;
  revision: number;
  hasSaved: boolean;
  saveTimer: NodeJS.Timeout | null;
  idleTimer: NodeJS.Timeout | null;
  saving: Promise<void> | null;
  destroyed: boolean;
}

function toBytes(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) {
    const merged = Buffer.concat(data);
    return new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength);
  }
  return new Uint8Array(data as ArrayBuffer);
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly loading = new Map<string, Promise<Room | null>>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: Config,
    private readonly store: RoomStore,
  ) {}

  startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const [ws, conn] of room.conns) {
          if (!conn.isAlive) {
            logger.warn("terminating dead socket", { room: room.id, conn: conn.id });
            ws.terminate();
            continue;
          }
          conn.isAlive = false;
          try {
            ws.ping();
          } catch {
            ws.terminate();
          }
        }
      }
    }, HEARTBEAT_MS);
  }

  getStats(): { rooms: number; connections: number } {
    let connections = 0;
    for (const room of this.rooms.values()) connections += room.conns.size;
    return { rooms: this.rooms.size, connections };
  }

  async get(roomId: string): Promise<Room | null> {
    const existing = this.rooms.get(roomId);
    if (existing) {
      this.cancelIdleEviction(existing);
      return existing;
    }

    const inFlight = this.loading.get(roomId);
    if (inFlight) return inFlight;

    const promise = this.loadRoom(roomId).finally(() => {
      this.loading.delete(roomId);
    });
    this.loading.set(roomId, promise);
    return promise;
  }

  private async loadRoom(roomId: string): Promise<Room | null> {
    const stored = await this.store.load(roomId);
    if (!stored) return null;

    const room = this.createRoom(roomId, stored);
    this.rooms.set(roomId, room);
    logger.info("room loaded", {
      room: roomId,
      bytes: stored.state?.byteLength ?? 0,
      chars: room.text.length,
    });
    return room;
  }

  private createRoom(id: string, stored: StoredRoom): Room {
    const doc = new Y.Doc({ guid: id });
    const text = doc.getText(Y_TEXT_KEY);
    const meta = doc.getMap(Y_META_KEY);
    const awareness = new Awareness(doc);
    awareness.setLocalState(null);

    if (stored.state) {
      Y.applyUpdate(doc, stored.state, "load");
    } else if (stored.contentText) {
      doc.transact(() => {
        text.insert(0, stored.contentText);
      }, "load");
    }

    const hadLanguage = typeof meta.get("language") === "string";
    if (!hadLanguage) meta.set("language", stored.language);

    const room: Room = {
      id,
      doc,
      text,
      meta,
      awareness,
      conns: new Map(),
      chat: [],
      expiresAt: stored.expiresAt ? stored.expiresAt.getTime() : null,
      dirty: !hadLanguage,
      revision: 0,
      hasSaved: false,
      saveTimer: null,
      idleTimer: null,
      saving: null,
      destroyed: false,
    };

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "load" || room.destroyed) return;

      room.dirty = true;
      room.revision += 1;
      this.broadcast(room, encodeUpdate(update), origin);
      this.scheduleSave(room);

      if (room.text.length > this.config.maxTextChars) {
        logger.warn("room exceeds text cap", {
          room: room.id,
          chars: room.text.length,
          cap: this.config.maxTextChars,
        });
      }
    });

    awareness.on(
      "update",
      (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (room.destroyed) return;

        const originConn = room.conns.get(origin as WebSocket);
        if (originConn) {
          for (const clientId of changes.added) originConn.awarenessIds.add(clientId);
          for (const clientId of changes.updated) originConn.awarenessIds.add(clientId);
        }

        const changed = [...changes.added, ...changes.updated, ...changes.removed];
        if (changed.length === 0) return;

        const payload = encodeAwareness(room.awareness, changed);
        for (const [ws] of room.conns) {
          if (ws === origin) continue;
          this.send(ws, payload);
        }
      },
    );

    return room;
  }

  connect(room: Room, ws: WebSocket, principal: Principal): void {
    const conn: ConnInfo = {
      id: crypto.randomUUID(),
      role: principal.role,
      name: principal.name,
      readOnly: !canEditRole(principal.role),
      signedIn: principal.signedIn,
      ws,
      isAlive: true,
      windowStart: Date.now(),
      messageCount: 0,
      awarenessIds: new Set(),
    };

    room.conns.set(ws, conn);
    this.cancelIdleEviction(room);

    this.send(ws, encodeSyncStep1(room.doc));
    this.send(ws, encodeAwareness(room.awareness));
    if (room.chat.length > 0) {
      this.send(ws, encodeChat({ kind: "history", messages: room.chat }));
    }

    ws.on("pong", () => {
      conn.isAlive = true;
    });

    ws.on("message", (raw) => {
      const bytes = toBytes(raw);

      if (bytes.byteLength > this.config.maxMessageBytes) {
        ws.close(1009, "message too large");
        return;
      }

      if (!this.allowMessage(conn)) {
        logger.warn("rate limit hit", { room: room.id, conn: conn.id });
        ws.close(1008, "message rate exceeded");
        return;
      }

      if (isChatMessage(bytes)) {
        const payload = decodeChat(bytes);
        if (payload?.kind !== "message") return;
        if (!conn.signedIn) {
          logger.debug("chat rejected for anonymous participant", {
            room: room.id,
            conn: conn.id,
          });
          return;
        }

        room.chat.push(payload.entry);
        if (room.chat.length > CHAT_KEEP_PER_ROOM) {
          room.chat.splice(0, room.chat.length - CHAT_KEEP_PER_ROOM);
        }
        this.broadcast(room, encodeChat({ kind: "message", entry: payload.entry }), ws);
        return;
      }

      if (
        !conn.readOnly &&
        isDocumentUpdate(bytes) &&
        room.text.length >= this.config.maxTextChars
      ) {
        ws.close(1009, "document too large");
        return;
      }

      try {
        const reply = handleMessage(room.doc, room.awareness, bytes, ws, conn.readOnly);
        if (reply) this.send(ws, reply);
      } catch (error) {
        logger.warn("failed to handle message", {
          room: room.id,
          conn: conn.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ws.on("close", () => this.disconnect(room, ws));
    ws.on("error", () => this.disconnect(room, ws));

    logger.info("client joined", {
      room: room.id,
      conn: conn.id,
      role: conn.role,
      conns: room.conns.size,
    });
  }

  private allowMessage(conn: ConnInfo): boolean {
    const now = Date.now();
    if (now - conn.windowStart > MESSAGE_WINDOW_MS) {
      conn.windowStart = now;
      conn.messageCount = 0;
    }
    conn.messageCount += 1;
    return conn.messageCount <= MESSAGE_LIMIT;
  }

  private disconnect(room: Room, ws: WebSocket): void {
    const conn = room.conns.get(ws);
    if (!conn) return;

    room.conns.delete(ws);

    if (conn.awarenessIds.size > 0 && !room.destroyed) {
      removeAwarenessStates(room.awareness, Array.from(conn.awarenessIds), null);
    }

    logger.info("client left", {
      room: room.id,
      conn: conn.id,
      conns: room.conns.size,
    });

    if (room.conns.size === 0) {
      void this.saveNow(room).finally(() => {
        this.scheduleIdleEviction(room);
      });
    }
  }

  private broadcast(room: Room, payload: Uint8Array, except: unknown): void {
    for (const [ws] of room.conns) {
      if (ws === except) continue;
      this.send(ws, payload);
    }
  }

  private send(ws: WebSocket, payload: Uint8Array): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(payload, { binary: true });
    } catch (error) {
      logger.debug("send failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private scheduleSave(room: Room): void {
    if (room.saveTimer || room.destroyed) return;
    room.saveTimer = setTimeout(() => {
      room.saveTimer = null;
      void this.saveNow(room);
    }, this.config.saveDebounceMs);
  }

  private scheduleRetry(room: Room): void {
    if (room.saveTimer || room.destroyed) return;
    room.saveTimer = setTimeout(() => {
      room.saveTimer = null;
      void this.saveNow(room);
    }, 5_000);
  }

  async saveNow(room: Room): Promise<void> {
    if (room.destroyed) return;
    if (room.saving) return room.saving;
    if (room.hasSaved && !room.dirty) return;

    const revision = room.revision;
    const state = Y.encodeStateAsUpdate(room.doc);
    const contentText = room.text.toString();
    const language =
      typeof room.meta.get("language") === "string"
        ? (room.meta.get("language") as string)
        : "plaintext";

    room.saving = (async () => {
      try {
        await this.store.save(room.id, state, contentText, language);
        room.hasSaved = true;
        if (room.revision === revision) room.dirty = false;
      } catch (error) {
        room.dirty = true;
        logger.error("save failed", {
          room: room.id,
          error: error instanceof Error ? error.message : String(error),
        });
        this.scheduleRetry(room);
      } finally {
        room.saving = null;
      }
    })();

    return room.saving;
  }

  private cancelIdleEviction(room: Room): void {
    if (room.idleTimer) {
      clearTimeout(room.idleTimer);
      room.idleTimer = null;
    }
  }

  private scheduleIdleEviction(room: Room): void {
    this.cancelIdleEviction(room);
    room.idleTimer = setTimeout(() => {
      room.idleTimer = null;
      void this.evict(room.id);
    }, this.config.roomIdleEvictMs);
  }

  async evict(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.conns.size > 0) return;

    await this.saveNow(room);

    room.destroyed = true;
    if (room.saveTimer) clearTimeout(room.saveTimer);
    this.cancelIdleEviction(room);
    room.awareness.destroy();
    room.doc.destroy();
    this.rooms.delete(roomId);

    logger.info("room evicted", { room: roomId });
  }

  async shutdown(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;

    await Promise.allSettled(
      Array.from(this.rooms.values()).map(async (room) => {
        if (room.saveTimer) clearTimeout(room.saveTimer);
        await this.saveNow(room);
        room.destroyed = true;
        room.awareness.destroy();
        room.doc.destroy();
      }),
    );

    this.rooms.clear();
  }
}
