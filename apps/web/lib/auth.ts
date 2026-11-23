import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface Profile {
  id: string;
  username: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin()
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  return data ?? null;
}

export async function getUserFromBearer(token: string): Promise<User | null> {
  if (!token || token.length > 4096) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

export async function displayNameFor(user: User | null): Promise<string | null> {
  if (!user) return null;
  const profile = await getProfile(user.id);
  if (profile?.username) return profile.username;
  return user.email?.split("@")[0] ?? null;
}
