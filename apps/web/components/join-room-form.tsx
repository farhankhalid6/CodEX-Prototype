"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ROOM_ID_PATTERN } from "@codex/shared";
import { IconLink, IconLogIn } from "@/components/icons";

function extractSlug(value: string): string | null {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const segment = url.pathname.split("/").filter(Boolean).pop();
      return segment ? decodeURIComponent(segment) : null;
    } catch {
      return null;
    }
  }

  if (value.startsWith("/")) {
    const segment = value.split("?")[0].split("/").filter(Boolean).pop();
    if (!segment) return null;
    try {
      return decodeURIComponent(segment);
    } catch {
      return null;
    }
  }

  return value;
}

export function JoinRoomForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const raw = value.trim();

    if (!raw) {
      setFeedback("Enter a room link or code to join.");
      setInvalid(true);
      return;
    }

    const slug = extractSlug(raw);
    if (!slug || !ROOM_ID_PATTERN.test(slug)) {
      setFeedback("That room link or code doesn’t look right.");
      setInvalid(true);
      return;
    }

    setFeedback(`Opening ${slug}…`);
    setInvalid(false);
    router.push(`/r/${encodeURIComponent(slug)}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-studio-outline-variant bg-studio-surface-low p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-base text-studio-fg">Join an existing room</h2>
        <p className="text-xs leading-relaxed text-studio-muted">
          Paste a room link or code to jump straight into the session.
        </p>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={joinRoom}>
        <label className="relative flex-1">
          <span className="sr-only">Paste a room link or code</span>
          <IconLink
            width={18}
            height={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-studio-outline"
          />
          <input
            id="join-room-input"
            type="text"
            placeholder="Paste a room link or code"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback(null);
              setInvalid(false);
            }}
            className="studio-input pl-10 font-studio-mono text-xs"
          />
        </label>

        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-studio-outline-variant bg-studio-surface px-5 py-2.5 text-sm font-medium text-studio-primary transition-colors hover:bg-studio-surface-high"
        >
          <IconLogIn width={17} height={17} />
          Join
        </button>
      </form>

      {feedback ? (
        <p
          role={invalid ? "alert" : "status"}
          className={`font-studio-mono text-xs ${invalid ? "text-danger" : "text-studio-primary"}`}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
