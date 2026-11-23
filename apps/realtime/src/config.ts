import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ROOM_TOKEN_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(8080),
  REALTIME_ALLOWED_ORIGINS: z.string().default(""),
  MAX_TEXT_CHARS: z.coerce.number().int().positive().default(250_000),
  MAX_MESSAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(512 * 1024),
  MAX_CONNS_PER_ROOM: z.coerce.number().int().positive().default(25),
  ROOM_IDLE_EVICT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  SAVE_DEBOUNCE_MS: z.coerce.number().int().positive().default(7000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.string().default("development"),
});

export interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  roomTokenSecret: string;
  port: number;
  allowedOrigins: string[];
  maxTextChars: number;
  maxMessageBytes: number;
  maxConnsPerRoom: number;
  roomIdleEvictMs: number;
  saveDebounceMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
  nodeEnv: string;
}

export function loadConfig(): Config {
  const parsed = schema.safeParse({
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  });

  if (!parsed.success) {
    console.error("Invalid realtime configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const env = parsed.data;

  return {
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    roomTokenSecret: env.ROOM_TOKEN_SECRET,
    port: env.PORT,
    allowedOrigins: env.REALTIME_ALLOWED_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    maxTextChars: env.MAX_TEXT_CHARS,
    maxMessageBytes: env.MAX_MESSAGE_BYTES,
    maxConnsPerRoom: env.MAX_CONNS_PER_ROOM,
    roomIdleEvictMs: env.ROOM_IDLE_EVICT_MS,
    saveDebounceMs: env.SAVE_DEBOUNCE_MS,
    logLevel: env.LOG_LEVEL,
    nodeEnv: env.NODE_ENV,
  };
}

export function originAllowed(origin: string | undefined, config: Config): boolean {
  if (!origin) return true;
  if (config.allowedOrigins.length === 0) return config.nodeEnv !== "production";
  return config.allowedOrigins.includes(origin);
}
