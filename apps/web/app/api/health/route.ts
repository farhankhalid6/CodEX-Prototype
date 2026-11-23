import { aiConfigured } from "@/lib/env";
import { json } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;

  try {
    const { error } = await supabaseAdmin()
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .limit(1);
    database = !error;
  } catch {
    database = false;
  }

  return json({
    ok: true,
    service: "codeshare-web",
    database,
    aiConfigured: aiConfigured(),
    realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? null,
    timestamp: new Date().toISOString(),
  });
}
