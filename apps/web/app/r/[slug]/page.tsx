import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyShareToken, type RoomRole } from "@codex/shared";
import { IconEye, IconLock } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { displayNameFor, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRoomBySlug } from "@/lib/room-queries";
import { isExpired, resolveAccess } from "@/lib/rooms";
import { RoomClient } from "./room-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string | string[]; access?: string | string[] }>;
}

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { slug } = await params;

  try {
    const room = await getRoomBySlug(slug);
    return { title: room?.title ?? "Room" };
  } catch {
    return { title: "Room" };
  }
}

export default async function RoomPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { view, access } = await searchParams;
  const viewKey = Array.isArray(view) ? (view[0] ?? null) : (view ?? null);
  const shareToken = Array.isArray(access) ? (access[0] ?? null) : (access ?? null);

  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const user = await getCurrentUser();
  const sessionRole = resolveAccess(room, user?.id ?? null, viewKey);

  let role: RoomRole | null = sessionRole;
  let effectiveShareToken: string | null = null;

  if (sessionRole !== "owner" && sessionRole !== "viewer" && shareToken) {
    try {
      const claims = await verifyShareToken(env("ROOM_TOKEN_SECRET"), shareToken);
      if (claims.room === room.id) {
        role = claims.role;
        effectiveShareToken = shareToken;
      }
    } catch {}
  }

  if (!role) {
    return (
      <AccessNotice
        expired={isExpired(room)}
        privateRoom={room.visibility === "private"}
        slug={room.id}
        signedIn={Boolean(user)}
        username={await displayNameFor(user)}
      />
    );
  }

  return (
    <RoomClient
      slug={room.id}
      initialTitle={room.title}
      initialLanguage={room.language}
      role={role}
      canEdit={role === "owner" || role === "editor"}
      displayName={await displayNameFor(user)}
      expiresAt={room.expires_at}
      viewKey={viewKey}
      shareToken={effectiveShareToken}
    />
  );
}

function AccessNotice({
  expired,
  privateRoom,
  slug,
  signedIn,
  username,
}: {
  expired: boolean;
  privateRoom: boolean;
  slug: string;
  signedIn: boolean;
  username: string | null;
}) {
  const title = expired
    ? "This room has expired"
    : privateRoom
      ? "This room is private"
      : "You do not have access";
  const body = expired
    ? "Anonymous rooms are removed automatically after their expiry date. Ask the owner to share a fresh link."
    : privateRoom
      ? "The owner has limited editing to their account. If they sent you a read-only link, open that exact URL."
      : "This link is missing a valid room token. Ask the owner for a new link.";

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader username={username} />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-20">
        <div className="card p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-panel2 text-muted">
            {expired ? <IconEye width={22} height={22} /> : <IconLock width={22} height={22} />}
          </span>

          <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/" className="btn btn-primary">
              Start a new room
            </Link>
            {!signedIn ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/r/${slug}`)}`}
                className="btn btn-ghost"
              >
                Sign in
              </Link>
            ) : (
              <Link href="/dashboard" className="btn btn-ghost">
                Go to dashboard
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
