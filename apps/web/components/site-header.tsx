import Link from "next/link";
import { IconBolt, IconCode } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

interface Props {
  username?: string | null;
}

export function SiteHeader({ username }: Props) {
  return (
    <header className="border-b border-studio-outline-variant bg-studio-surface-lowest">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-studio-primary-button text-studio-on-primary-button">
            <IconCode width={18} height={18} strokeWidth={2.2} />
          </span>
          <span className="flex items-center gap-2">
            <span className="font-display text-lg text-studio-fg">CodEX</span>
            <span className="hidden font-studio-mono text-[11px] text-studio-muted sm:inline">
              by Team NullYex
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded border border-studio-outline-variant bg-studio-surface px-2.5 py-1 font-studio-mono text-[11px] text-studio-muted sm:inline-flex">
            <IconBolt width={14} height={14} className="text-studio-primary" />
            Zero Sign-up
          </span>

          {username ? (
            <span className="hidden max-w-[150px] truncate font-studio-mono text-[11px] text-studio-muted md:block">
              @{username}
            </span>
          ) : null}

          <Link
            href={username ? "/dashboard" : "/login"}
            className="inline-flex items-center rounded-lg border border-studio-outline-variant bg-studio-surface px-3 py-1.5 text-xs font-medium text-studio-primary transition-colors hover:bg-studio-surface-high"
          >
            {username ? "Dashboard" : "Sign in"}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
