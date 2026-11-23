import { LANGUAGES } from "@codex/shared";
import { HomeStudio } from "@/components/home-studio";
import { SiteHeader } from "@/components/site-header";
import { displayNameFor, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const username = await displayNameFor(user);

  return (
    <div className="home-studio studio-grid-bg flex min-h-dvh flex-col">
      <SiteHeader username={username} />
      <HomeStudio signedIn={Boolean(user)} defaultName={username} />

      <footer className="border-t border-studio-outline-variant bg-studio-surface-lowest">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-studio-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>CodEX · Crafted by Team NullYex</span>
          <span className="font-studio-mono text-[11px]">
            Push / pull code rooms · {LANGUAGES.length} languages
          </span>
        </div>
      </footer>
    </div>
  );
}
