"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCESS_LEVEL_LABELS, ROOM_ACCESS_LEVELS, type RoomAccessLevel } from "@codex/shared";
import { IconCheck, IconChevronDown, IconCopy, IconLink, IconX } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  token: string | null;
  onCopied: (message: string) => void;
}

export function ShareDialog({ open, onClose, slug, token, onCopied }: Props) {
  const [access, setAccess] = useState<RoomAccessLevel>("viewer");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createLink = useCallback(
    async (level: RoomAccessLevel) => {
      if (!open || !token) return;

      setLoading(true);
      setError(null);
      setUrl("");
      setCopied(false);

      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(slug)}/share`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ access: level }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.url) {
          throw new Error(data.error ?? "Could not create the share link");
        }
        setUrl(data.url);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create the share link");
      } finally {
        setLoading(false);
      }
    },
    [open, slug, token],
  );

  useEffect(() => {
    if (open) void createLink(access);
  }, [open, access, createLink]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copyLink() {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const area = document.createElement("textarea");
        area.value = url;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(true);
      onCopied("Share link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onCopied("Could not copy the link");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="card w-full max-w-md p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="share-dialog-title" className="flex items-center gap-2 text-base font-semibold">
              <IconLink width={17} height={17} className="text-accent" />
              Share this room
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Choose what people can do when they open the link.
            </p>
          </div>
          <button type="button" className="icon-btn size-8" onClick={onClose} aria-label="Close">
            <IconX width={16} height={16} />
          </button>
        </div>

        <label className="mt-5 block text-[11px] font-medium tracking-wide text-muted uppercase">
          Access level
        </label>
        <div className="relative mt-1.5">
          <select
            className="input h-11 w-full appearance-none pr-9 text-sm"
            value={access}
            onChange={(event) => setAccess(event.target.value as RoomAccessLevel)}
            aria-label="Access level"
          >
            {ROOM_ACCESS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ACCESS_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          <IconChevronDown
            width={15}
            height={15}
            className="pointer-events-none absolute top-3.5 right-3 text-muted"
          />
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          {access === "viewer" && "They can read the code but cannot change it."}
          {access === "commentor" &&
            "Code stays read-only; chat works without an account or email."}
          {access === "editor" && "They can edit the shared document; code syncs when they push."}
        </p>

        <label className="mt-4 block text-[11px] font-medium tracking-wide text-muted uppercase">
          Link
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            className="input h-10 min-w-0 flex-1 font-mono text-[11px]"
            readOnly
            value={url || (loading ? "Creating link…" : error ? "Unavailable" : "")}
            aria-label="Share link"
          />
          <button
            type="button"
            className="btn btn-primary h-10 shrink-0 gap-1.5"
            onClick={() => void copyLink()}
            disabled={!url || loading}
          >
            {copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />}
            Copy link
          </button>
        </div>

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        {!token ? (
          <p className="mt-2 text-xs text-muted">Connect to the room before sharing.</p>
        ) : null}

        <p className="mt-4 border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
          Links are signed and expire after 30 days. Access levels are enforced by the realtime
          server, not just by the interface.
        </p>
      </div>
    </div>
  );
}
