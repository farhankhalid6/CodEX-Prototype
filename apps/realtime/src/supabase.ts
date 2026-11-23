import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.js";

export function createAdminClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-application-name": "codeshare-realtime" },
    },
  });
}
