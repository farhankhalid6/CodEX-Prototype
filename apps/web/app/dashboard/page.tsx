import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { displayNameFor, getCurrentUser } from "@/lib/auth";
import { listRoomsForOwner } from "@/lib/room-queries";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  const username = await displayNameFor(user);
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const rooms = await listRoomsForOwner(user.id, query);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader username={username} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-4 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
              Your library
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Saved snippets</h1>
            <p className="mt-1 text-sm text-muted">
              {username ? `Signed in as @${username}. ` : ""}
              Search by title or code, copy a link, or fork someone else&apos;s room.
            </p>
          </div>

          <Link href="/" className="btn btn-primary">
            New room
          </Link>
        </div>

        <DashboardClient
          rooms={rooms}
          query={query}
          username={username}
          email={user.email ?? null}
        />
      </main>
    </div>
  );
}
