import { supabaseAdmin } from "@/lib/supabase/admin";
import { ROOM_FULL_COLUMNS, type RoomRow } from "@/lib/rooms";

export async function getRoomBySlug(slug: string): Promise<RoomRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .select(ROOM_FULL_COLUMNS)
    .eq("id", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load room: ${error.message}`);
  return (data as RoomRow | null) ?? null;
}

export async function getRoomBySlugForViewer(slug: string): Promise<RoomRow | null> {
  return getRoomBySlug(slug);
}

export interface RoomListItem {
  id: string;
  title: string;
  language: string;
  visibility: string;
  read_only_slug: string;
  updated_at: string;
  expires_at: string | null;
  content_text: string;
}

export async function listRoomsForOwner(ownerId: string, query?: string): Promise<RoomListItem[]> {
  let request = supabaseAdmin()
    .from("rooms")
    .select("id, title, language, visibility, read_only_slug, updated_at, expires_at, content_text")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(60);

  const trimmed = query?.trim();
  if (trimmed) {
    const safe = trimmed.replace(/[%,()]/g, " ").slice(0, 80);
    request = request.or(`title.ilike.%${safe}%,content_text.ilike.%${safe}%`);
  }

  const { data, error } = await request;
  if (error) throw new Error(`Failed to list rooms: ${error.message}`);
  return (data ?? []) as RoomListItem[];
}
