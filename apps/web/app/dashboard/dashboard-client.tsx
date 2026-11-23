"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FILE_EXTENSIONS, LANGUAGE_LABELS, isLanguage } from "@codex/shared";
import {
  IconCopy,
  IconEye,
  IconFolder,
  IconLink,
  IconLogOut,
  IconSearch,
  IconTrash,
  IconX,
} from "@/components/icons";
import type { RoomListItem } from "@/lib/room-queries";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Props {
  rooms: RoomListItem[];
  query: string;
  username: string | null;
  email: string | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";

  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

export function DashboardClient({ rooms, query, username, email }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(rooms);
  const [search, setSearch] = useState(query);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(rooms);
  }, [rooms]);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    const next = search.trim();
    if (next === query) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(next ? `/dashboard?q=${encodeURIComponent(next)}` : "/dashboard");
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, search]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  async function remove(room: RoomListItem) {
    const confirmed = window.confirm(
      `Delete "${room.title}" and its saved room data? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(room.id);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.id)}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not delete the room");

      setItems((current) => current.filter((item) => item.id !== room.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the room");
    } finally {
      setDeleting(null);
    }
  }

  async function signOut() {
    try {
      await supabaseBrowser().auth.signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            className="input pl-9 pr-9"
            placeholder="Search titles and code…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search saved snippets"
          />
          {search ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-panel2 hover:text-fg"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IconX width={13} height={13} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          {pending ? <span className="animate-pulse">Searching…</span> : null}
          <span>
            {items.length} {items.length === 1 ? "room" : "rooms"}
          </span>
          <span aria-hidden>·</span>
          <button
            type="button"
            className="btn btn-ghost h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => void signOut()}
            title={email ?? username ?? "Sign out"}
          >
            <IconLogOut width={13} height={13} />
            Sign out
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="card mt-6 px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-panel2 text-muted">
            <IconFolder width={22} height={22} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            {query ? "No snippets match that search" : "No saved snippets yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {query
              ? `Nothing matched “${query}”. Try a shorter phrase or part of a function name.`
              : "Rooms you create while signed in appear here. They never expire, and every one keeps version history."}
          </p>
          {query ? (
            <button type="button" className="btn btn-ghost mt-5" onClick={() => setSearch("")}>
              Clear search
            </button>
          ) : (
            <Link href="/" className="btn btn-primary mt-5">
              Create your first room
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((room) => {
            const language = isLanguage(room.language) ? room.language : "plaintext";
            const extension = FILE_EXTENSIONS[language] ?? "txt";
            const preview = room.content_text.replace(/\s+/g, " ").trim();

            return (
              <article
                key={room.id}
                className="card flex flex-col gap-3 p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{room.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span className="chip px-2 py-0.5">{LANGUAGE_LABELS[language]}</span>
                      <span className="font-mono">.{extension}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(room.updated_at)}</span>
                    </p>
                  </div>

                  <span
                    className={`chip shrink-0 px-2 py-0.5 ${
                      room.visibility === "private"
                        ? "border-warning/30 text-warning"
                        : "border-success/30 text-success"
                    }`}
                  >
                    {room.visibility === "private" ? "Private" : "Link"}
                  </span>
                </div>

                <p className="line-clamp-3 min-h-[2.4rem] font-mono text-[11.5px] leading-relaxed text-muted">
                  {preview || "Empty room — open it and start typing."}
                </p>

                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[10.5px] text-muted">{expiryLabel(room.expires_at)}</span>

                  <div className="flex items-center gap-1">
                    <Link href={`/r/${room.id}`} className="btn btn-primary h-8 px-2.5 text-xs">
                      Open
                    </Link>

                    <button
                      type="button"
                      className="icon-btn size-8"
                      onClick={() =>
                        void copy(`${window.location.origin}/r/${room.id}`, `${room.id}:edit`)
                      }
                      title={copied === `${room.id}:edit` ? "Copied" : "Copy edit link"}
                      aria-label="Copy edit link"
                    >
                      <IconLink width={14} height={14} />
                    </button>

                    <button
                      type="button"
                      className="icon-btn size-8"
                      onClick={() =>
                        void copy(
                          `${window.location.origin}/r/${room.id}?view=${room.read_only_slug}`,
                          `${room.id}:view`,
                        )
                      }
                      title={copied === `${room.id}:view` ? "Copied" : "Copy read-only link"}
                      aria-label="Copy read-only link"
                    >
                      <IconEye width={14} height={14} />
                    </button>

                    <button
                      type="button"
                      className="icon-btn size-8 text-muted hover:text-danger"
                      onClick={() => void remove(room)}
                      disabled={deleting === room.id}
                      title="Delete room"
                      aria-label="Delete room"
                    >
                      {deleting === room.id ? (
                        <IconX width={14} height={14} />
                      ) : (
                        <IconTrash width={14} height={14} />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted">
        <IconCopy width={12} height={12} />
        Search covers your newest 60 rooms. Read-only links are hidden from everyone else.
      </p>
    </div>
  );
}
