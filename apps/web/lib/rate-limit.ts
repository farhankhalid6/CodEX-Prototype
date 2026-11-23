import { numberEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface AiRateResult {
  allowed: boolean;
  reason?: "user" | "ip" | "budget";
  retryAfterSeconds: number;
  userCount: number;
  ipCount: number;
  tokensToday: number;
}

function windowStart(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export async function checkAiRateLimit(input: {
  actorId: string;
  ipHash: string | null;
}): Promise<AiRateResult> {
  const perUser = numberEnv("AI_RATE_LIMIT_USER", 12);
  const perIp = numberEnv("AI_RATE_LIMIT_IP", 20);
  const windowMinutes = numberEnv("AI_RATE_WINDOW_MINUTES", 10);
  const dailyBudget = numberEnv("AI_DAILY_TOKEN_BUDGET", 250_000);

  const admin = supabaseAdmin();
  const since = windowStart(windowMinutes);

  const userQuery = admin
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", input.actorId)
    .gte("created_at", since);

  const ipQuery = input.ipHash
    ? admin
        .from("ai_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", input.ipHash)
        .gte("created_at", since)
    : null;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [userResult, ipResult, tokensResult] = await Promise.all([
    userQuery,
    ipQuery ?? Promise.resolve({ count: 0, error: null }),
    admin.rpc("ai_tokens_since", { p_since: startOfDay.toISOString() }),
  ]);

  const userCount = userResult.count ?? 0;
  const ipCount = ipResult.count ?? 0;
  const tokensToday = Number(tokensResult.data ?? 0) || 0;

  const retryAfterSeconds = windowMinutes * 60;

  if (tokensToday >= dailyBudget) {
    return {
      allowed: false,
      reason: "budget",
      retryAfterSeconds,
      userCount,
      ipCount,
      tokensToday,
    };
  }

  if (userCount >= perUser) {
    return {
      allowed: false,
      reason: "user",
      retryAfterSeconds,
      userCount,
      ipCount,
      tokensToday,
    };
  }

  if (ipCount >= perIp) {
    return {
      allowed: false,
      reason: "ip",
      retryAfterSeconds,
      userCount,
      ipCount,
      tokensToday,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, userCount, ipCount, tokensToday };
}

export async function checkRoomCreateLimit(ipHash: string): Promise<boolean> {
  const limit = numberEnv("ROOM_CREATE_LIMIT_PER_HOUR", 20);
  const since = new Date(Date.now() - 60 * 60_000).toISOString();

  const { count, error } = await supabaseAdmin()
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("created_ip_hash", ipHash)
    .gte("created_at", since);

  if (error) return true;
  return (count ?? 0) < limit;
}
