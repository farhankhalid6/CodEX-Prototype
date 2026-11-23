"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_ROOM_TITLE,
  FILE_EXTENSIONS,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
} from "@codex/shared";
import {
  IconCheckCircle,
  IconChevronDown,
  IconClock,
  IconPlusBox,
  IconSearch,
  IconTerminal,
} from "@/components/icons";
import { getDisplayName, setDisplayName } from "@/lib/client-storage";

interface Props {
  signedIn: boolean;
  defaultName?: string | null;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

type ExpiryOption = "1" | "7" | "30" | "never";

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string; hint: string }[] = [
  { value: "1", label: "1 day", hint: "24h" },
  { value: "7", label: "7 Days", hint: "1 wk" },
  { value: "30", label: "30 Days", hint: "1 mo" },
  { value: "never", label: "Never", hint: "∞" },
];

function extensionLabel(language: Language): string {
  return `.${FILE_EXTENSIONS[language]}`;
}

export function CreateRoomForm({ signedIn, defaultName, language, onLanguageChange }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public-link" | "private">("public-link");
  const [expiry, setExpiry] = useState<ExpiryOption>("7");
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [expiryOpen, setExpiryOpen] = useState(false);

  const languageRef = useRef<HTMLDivElement>(null);
  const expiryRef = useRef<HTMLDivElement>(null);
  const languageSearchRef = useRef<HTMLInputElement>(null);

  const expiryOptions = signedIn
    ? EXPIRY_OPTIONS
    : EXPIRY_OPTIONS.filter((option) => option.value !== "never");
  const selectedExpiry =
    expiryOptions.find((option) => option.value === expiry) ?? expiryOptions[1];

  const filteredLanguages = LANGUAGES.filter((value) => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return true;
    const extension = FILE_EXTENSIONS[value];
    return (
      LANGUAGE_LABELS[value].toLowerCase().includes(query) ||
      extension.includes(query) ||
      `.${extension}`.includes(query)
    );
  });

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (languageRef.current && !languageRef.current.contains(target)) setLanguageOpen(false);
      if (expiryRef.current && !expiryRef.current.contains(target)) setExpiryOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageOpen(false);
        setExpiryOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (languageOpen) languageSearchRef.current?.focus();
  }, [languageOpen]);

  function selectLanguage(value: Language) {
    onLanguageChange(value);
    setLanguageOpen(false);
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCreatedSlug(null);

    const displayName = (name || defaultName || getDisplayName()).trim();
    if (displayName) setDisplayName(displayName);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || DEFAULT_ROOM_TITLE,
          language,
          visibility: signedIn ? visibility : "public-link",
          expiresInDays: expiry === "never" ? null : Number(expiry),
          displayName: displayName || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        slug?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Could not create the room (${response.status})`);
      }
      if (!data.slug) {
        throw new Error("The room was created, but no room link was returned.");
      }

      setCreatedSlug(data.slug);
      router.push(`/r/${encodeURIComponent(data.slug)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col overflow-visible rounded-xl border border-studio-outline-variant bg-studio-surface-low">
      <div className="flex items-center justify-between gap-4 rounded-t-xl border-b border-studio-outline-variant bg-studio-surface px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-studio-muted">
          <IconTerminal width={16} height={16} className="text-studio-primary" />
          <span className="font-studio-mono text-xs">new room</span>
        </div>
        <span className="rounded border border-studio-outline-variant bg-studio-surface-lowest px-2 py-0.5 font-studio-mono text-[11px] text-studio-muted">
          {LANGUAGES.length} langs
        </span>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-6 md:p-8">
        <header className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl leading-tight text-studio-fg">Start a room</h2>
          <p className="text-sm text-studio-muted">
            Configure your room title, syntax language, and auto-expiration timer.
          </p>
        </header>

        <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={createRoom}>
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-medium text-studio-fg">Title</span>
            <input
              id="room-title"
              className="studio-input"
              placeholder="e.g. API Rate Limiter Pair Session"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div ref={languageRef} className="relative flex flex-col gap-2">
            <span id="language-select-label" className="text-xs font-medium text-studio-fg">
              Language
            </span>
            <button
              id="language-select-trigger"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={languageOpen}
              aria-labelledby="language-select-label"
              aria-controls="language-select-listbox"
              onClick={() => {
                if (languageOpen) {
                  setLanguageOpen(false);
                } else {
                  setExpiryOpen(false);
                  setLanguageSearch("");
                  setLanguageOpen(true);
                }
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-studio-outline-variant bg-studio-surface-lowest px-3.5 py-2.5 text-left text-studio-fg transition-colors hover:border-studio-outline focus:border-studio-primary focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <span className="rounded border border-studio-outline-variant bg-studio-surface px-1.5 py-0.5 font-studio-mono text-[11px] text-studio-primary">
                  {extensionLabel(language)}
                </span>
                <span className="text-sm">{LANGUAGE_LABELS[language]}</span>
              </span>
              <IconChevronDown
                width={18}
                height={18}
                className={`shrink-0 text-studio-muted transition-transform ${languageOpen ? "rotate-180" : ""}`}
              />
            </button>

            {languageOpen ? (
              <div className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-studio-outline-variant bg-studio-surface-high shadow-2xl shadow-black/30">
                <div className="border-b border-studio-outline-variant bg-studio-surface p-2">
                  <div className="relative">
                    <IconSearch
                      width={15}
                      height={15}
                      className="absolute top-1/2 left-2.5 -translate-y-1/2 text-studio-outline"
                    />
                    <input
                      ref={languageSearchRef}
                      type="text"
                      value={languageSearch}
                      placeholder="Filter languages..."
                      aria-label="Filter languages"
                      onChange={(event) => setLanguageSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && filteredLanguages.length > 0) {
                          event.preventDefault();
                          selectLanguage(filteredLanguages[0]);
                        }
                      }}
                      className="studio-input py-1.5 pl-8 text-xs"
                    />
                  </div>
                </div>
                <ul
                  id="language-select-listbox"
                  role="listbox"
                  aria-labelledby="language-select-label"
                  className="max-h-60 overflow-y-auto py-1"
                >
                  {filteredLanguages.length === 0 ? (
                    <li className="px-3.5 py-2 text-xs text-studio-muted">No languages match.</li>
                  ) : (
                    filteredLanguages.map((value) => (
                      <li
                        key={value}
                        role="option"
                        aria-selected={value === language}
                        className="flex items-center justify-between"
                      >
                        <button
                          type="button"
                          onClick={() => selectLanguage(value)}
                          className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors hover:bg-studio-surface ${
                            value === language ? "text-studio-primary" : "text-studio-fg"
                          }`}
                        >
                          <span>{LANGUAGE_LABELS[value]}</span>
                          <span className="font-studio-mono text-[11px] text-studio-muted">
                            {extensionLabel(value)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          <div ref={expiryRef} className="relative flex flex-col gap-2">
            <span id="expiry-select-label" className="text-xs font-medium text-studio-fg">
              Expires in
            </span>
            <button
              id="expiry-select-trigger"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={expiryOpen}
              aria-labelledby="expiry-select-label"
              aria-controls="expiry-select-listbox"
              onClick={() => {
                if (expiryOpen) {
                  setExpiryOpen(false);
                } else {
                  setLanguageOpen(false);
                  setExpiryOpen(true);
                }
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-studio-outline-variant bg-studio-surface-lowest px-3.5 py-2.5 text-left text-studio-fg transition-colors hover:border-studio-outline focus:border-studio-primary focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <IconClock width={16} height={16} className="text-studio-primary" />
                <span className="text-sm">{selectedExpiry?.label ?? "7 Days"}</span>
              </span>
              <IconChevronDown
                width={18}
                height={18}
                className={`shrink-0 text-studio-muted transition-transform ${expiryOpen ? "rotate-180" : ""}`}
              />
            </button>

            {expiryOpen ? (
              <ul
                id="expiry-select-listbox"
                role="listbox"
                aria-labelledby="expiry-select-label"
                className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-studio-outline-variant bg-studio-surface-high py-1 shadow-2xl shadow-black/30"
              >
                {expiryOptions.map((option) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={expiry === option.value}
                    className="flex items-center justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpiry(option.value);
                        setExpiryOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-studio-surface ${
                        expiry === option.value ? "text-studio-primary" : "text-studio-fg"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className="font-studio-mono text-[11px] text-studio-muted">
                        {option.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {signedIn ? (
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-medium text-studio-fg">Who can edit</span>
              <select
                id="room-visibility"
                className="studio-input"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public-link" | "private")}
              >
                <option value="public-link">Anyone with the link</option>
                <option value="private">Only me (share a read-only link)</option>
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-medium text-studio-fg">User Name</span>
            <input
              id="room-name"
              className="studio-input"
              placeholder="Enter your display name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <div className="flex flex-col justify-between gap-4 pt-1 sm:col-span-2 sm:flex-row sm:items-center">
            <p className="text-xs text-studio-muted">
              Generates a shareable room code and live editor URL.
            </p>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-studio-primary-button px-6 py-3 text-sm font-medium text-studio-on-primary-button transition-colors hover:bg-studio-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
              disabled={busy}
            >
              <IconPlusBox width={19} height={19} />
              {busy ? "Creating room…" : "Create Room"}
            </button>
          </div>
        </form>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        {createdSlug ? (
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-lg border border-studio-outline-variant bg-studio-surface p-4"
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-studio-fg">Room ready</span>
              <span className="font-studio-mono text-xs text-studio-primary">/r/{createdSlug}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded border border-studio-outline-variant bg-studio-surface-lowest px-2.5 py-1 text-xs text-studio-fg">
              <IconCheckCircle width={15} height={15} className="text-studio-success" />
              Ready
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
