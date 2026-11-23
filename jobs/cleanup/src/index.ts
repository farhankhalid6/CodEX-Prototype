import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { createClient, type PostgrestError } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Summary {
  ok: boolean;
  dryRun: boolean;
  expiredRooms: number;
  deletedRooms: number;
  oldAiRequests: number;
  deletedAiRequests: number;
  database: boolean;
  durationMs: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[cleanup] missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function positiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function describe(error: PostgrestError | null): string {
  if (!error) return "unknown error";
  return `${error.code ?? "?"}: ${error.message}`;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const aiRetentionDays = positiveNumber("AI_REQUEST_RETENTION_DAYS", 90);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "codeshare-cleanup" } },
  });

  const now = new Date().toISOString();
  const aiCutoff = new Date(Date.now() - aiRetentionDays * DAY_MS).toISOString();

  const summary: Summary = {
    ok: true,
    dryRun,
    expiredRooms: 0,
    deletedRooms: 0,
    oldAiRequests: 0,
    deletedAiRequests: 0,
    database: false,
    durationMs: 0,
  };

  const expired = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  if (expired.error) {
    summary.ok = false;
    console.error("[cleanup] could not count expired rooms:", describe(expired.error));
  } else {
    summary.expiredRooms = expired.count ?? 0;

    if (!dryRun && summary.expiredRooms > 0) {
      const deleted = await supabase
        .from("rooms")
        .delete({ count: "exact" })
        .not("expires_at", "is", null)
        .lt("expires_at", now);

      if (deleted.error) {
        summary.ok = false;
        console.error("[cleanup] could not delete expired rooms:", describe(deleted.error));
      } else {
        summary.deletedRooms = deleted.count ?? 0;
      }
    }
  }

  const oldAi = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .lt("created_at", aiCutoff);

  if (oldAi.error) {
    summary.ok = false;
    console.error("[cleanup] could not count old ai_requests:", describe(oldAi.error));
  } else {
    summary.oldAiRequests = oldAi.count ?? 0;

    if (!dryRun && summary.oldAiRequests > 0) {
      const deleted = await supabase
        .from("ai_requests")
        .delete({ count: "exact" })
        .lt("created_at", aiCutoff);

      if (deleted.error) {
        summary.ok = false;
        console.error("[cleanup] could not delete old ai_requests:", describe(deleted.error));
      } else {
        summary.deletedAiRequests = deleted.count ?? 0;
      }
    }
  }

  const ping = await supabase.from("rooms").select("id", { head: true, count: "exact" }).limit(1);
  summary.database = !ping.error;
  if (ping.error) {
    summary.ok = false;
    console.error("[cleanup] database ping failed:", describe(ping.error));
  }

  summary.durationMs = Date.now() - startedAt;
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    "[cleanup] unexpected failure:",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
