import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { loadConfig, originAllowed } from "./config.js";
import { logger, setLogLevel } from "./logger.js";
import { createAdminClient } from "./supabase.js";
import { RoomStore } from "./persistence.js";
import { Authenticator } from "./auth.js";
import { RoomManager } from "./rooms.js";

const config = loadConfig();
setLogLevel(config.logLevel);

const supabase = createAdminClient(config);
const store = new RoomStore(supabase);
const authenticator = new Authenticator(config, supabase);
const manager = new RoomManager(config, store);

manager.startHeartbeat();

const startedAt = Date.now();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
    const stats = manager.getStats();
    sendJson(res, 200, {
      ok: true,
      service: "codeshare-realtime",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      rooms: stats.rooms,
      connections: stats.connections,
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "not found" });
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: config.maxMessageBytes,
  perMessageDeflate: false,
});

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (socket.destroyed) return;
  const body = message;
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      "\r\n" +
      body,
  );
  socket.destroy();
}

async function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = /^\/ws\/([A-Za-z0-9_-]{6,64})$/.exec(url.pathname);

  if (!match?.[1]) return rejectUpgrade(socket, 404, "Not Found");
  const roomId = match[1];

  if (!originAllowed(req.headers.origin, config)) {
    logger.warn("blocked origin", { origin: req.headers.origin, room: roomId });
    return rejectUpgrade(socket, 403, "Forbidden");
  }

  const token = url.searchParams.get("token") ?? "";
  const principal = await authenticator.authenticate(token, roomId);
  if (!principal) {
    logger.warn("rejected websocket auth", { room: roomId });
    return rejectUpgrade(socket, 401, "Unauthorized");
  }

  const room = await manager.get(roomId);
  if (!room) return rejectUpgrade(socket, 404, "Room not found");

  if (room.expiresAt !== null && room.expiresAt < Date.now()) {
    await manager.evict(roomId);
    return rejectUpgrade(socket, 410, "Room expired");
  }

  if (room.conns.size >= config.maxConnsPerRoom) {
    return rejectUpgrade(socket, 429, "Room is full");
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    manager.connect(room, ws, principal);
  });
}

server.on("upgrade", (req, socket, head) => {
  void handleUpgrade(req, socket, head).catch((error: unknown) => {
    logger.error("upgrade failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    rejectUpgrade(socket, 500, "Internal Server Error");
  });
});

server.listen(config.port, () => {
  logger.info("realtime server listening", {
    port: config.port,
    env: config.nodeEnv,
    origins: config.allowedOrigins,
  });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutting down", { signal });

  server.close();

  for (const client of wss.clients) {
    try {
      client.close(1001, "server shutting down");
    } catch {
      client.terminate();
    }
  }

  await manager.shutdown();
  wss.close();

  setTimeout(() => process.exit(0), 250).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error: error.message, stack: error.stack });
});
