"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  DEFAULT_LANGUAGE,
  FILE_EXTENSIONS,
  LANGUAGES,
  LANGUAGE_LABELS,
  MAX_CODE_CHARS,
  Y_TEXT_KEY,
  guestName,
  isLanguage,
  slugify,
  type Language,
  type RoomRole,
} from "@codex/shared";
import { CodeEditor } from "@/components/editor/code-editor";
import {
  IconCode,
  IconDownload,
  IconEye,
  IconFormat,
  IconLink,
  IconPencil,
  IconShare,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { AiPanel } from "@/components/room/ai-panel";
import { ChatPanel } from "@/components/room/chat-panel";
import { PushPullPanel } from "@/components/room/push-pull-panel";
import { ShareDialog } from "@/components/room/share-dialog";
import {
  getClientId,
  getDisplayName,
  getStoredLanguage,
  setDisplayName,
  setStoredLanguage,
} from "@/lib/client-storage";
import { loadLocalCode, saveLocalCode } from "@/lib/draft-doc";
import { formatCode } from "@/lib/format-code";

type Editor = MonacoEditor.IStandaloneCodeEditor;
type ConnectionStatus = "connecting" | "connected" | "disconnected";
type SidePanel = "ai" | "chat" | "sync";

const PANEL_WIDTH_KEY = "codex:room-panel-width";
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 640;
const MIN_EDITOR_WIDTH = 360;
const RESIZER_WIDTH = 8;

interface Props {
  slug: string;
  initialTitle: string;
  initialLanguage: string;
  role: RoomRole;
  canEdit: boolean;
  displayName: string | null;
  expiresAt: string | null;
  viewKey: string | null;
  shareToken: string | null;
}

function realtimeBase(): string {
  const configured = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080/ws`;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function clampPanelWidth(value: number): number {
  if (!Number.isFinite(value)) return MIN_PANEL_WIDTH;

  const viewportMax =
    typeof window === "undefined"
      ? MAX_PANEL_WIDTH
      : Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, window.innerWidth - MIN_EDITOR_WIDTH - RESIZER_WIDTH),
        );

  return Math.min(Math.max(Math.round(value), MIN_PANEL_WIDTH), viewportMax);
}

export function RoomClient({
  slug,
  initialTitle,
  initialLanguage,
  role,
  canEdit,
  displayName,
  expiresAt,
  viewKey,
  shareToken,
}: Props) {
  const initial = isLanguage(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;

  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [language, setLanguage] = useState<Language>(initial);
  const [chars, setChars] = useState(0);
  const [selection, setSelection] = useState("");
  const [panel, setPanel] = useState<SidePanel>("ai");
  const [userName, setUserName] = useState(displayName ?? "");
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sharedCode, setSharedCode] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(380);
  const [panelWidthLoaded, setPanelWidthLoaded] = useState(false);

  const splitRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef(false);
  const clientIdRef = useRef("");
  const userNameRef = useRef(displayName ?? "");
  const codeRef = useRef("");
  const sharedCodeRef = useRef("");
  const readonlySeededRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    document.title = `${title} · CodEX`;
  }, [title]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PANEL_WIDTH_KEY);
      if (stored) setPanelWidth(clampPanelWidth(Number.parseInt(stored, 10)));
    } catch {}
    setPanelWidthLoaded(true);
  }, []);

  useEffect(() => {
    if (!panelWidthLoaded) return;
    try {
      window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    } catch {}
  }, [panelWidth, panelWidthLoaded]);

  useEffect(() => {
    const onResize = () => setPanelWidth((current) => clampPanelWidth(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    const clientId = clientIdRef.current || getClientId();
    clientIdRef.current = clientId;

    const name = (displayName || getDisplayName() || guestName(clientId)).trim().slice(0, 40);
    userNameRef.current = name;
    setUserName(name);

    const stored = canEdit ? loadLocalCode(slug, clientId) : "";
    codeRef.current = stored;
    setCode(stored);
    setChars(stored.length);
  }, [slug, canEdit, displayName]);

  useEffect(() => {
    const stored = getStoredLanguage(slug);
    if (stored && isLanguage(stored)) setLanguage(stored);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    let created: WebsocketProvider | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let removeVisibilityListener: (() => void) | null = null;
    let lastMintAt = 0;

    const ydoc = new Y.Doc();
    setDoc(ydoc);
    setProvider(null);
    setToken(null);
    setTokenError(null);
    setStatus("connecting");
    setSynced(false);

    const mint = async (): Promise<string> => {
      const response = await fetch(`/api/rooms/${encodeURIComponent(slug)}/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          displayName: userNameRef.current,
          viewKey: viewKey ?? undefined,
          shareToken: shareToken ?? undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };

      if (!response.ok || !data.token) {
        throw new Error(data.error ?? `Could not join the room (${response.status})`);
      }

      lastMintAt = Date.now();
      return data.token;
    };

    (async () => {
      try {
        const firstToken = await mint();
        if (cancelled) return;

        setToken(firstToken);

        const websocket = new WebsocketProvider(realtimeBase(), slug, ydoc, {
          connect: false,
          params: { token: firstToken },
        });

        created = websocket;
        setProvider(websocket);

        websocket.on("status", (event: { status: string }) => {
          if (cancelled) return;

          if (event.status === "connected") {
            setStatus("connected");
          } else if (event.status === "connecting") {
            setStatus("connecting");
            setSynced(false);
          } else {
            setStatus("disconnected");
            setSynced(false);
          }
        });

        websocket.on("sync", (isSynced: boolean) => {
          if (!cancelled) setSynced(isSynced);
        });

        websocket.connect();

        const refreshToken = async () => {
          try {
            const next = await mint();
            if (cancelled || !created) return;
            created.params = { ...created.params, token: next };
            setToken(next);
          } catch {}
        };

        refreshTimer = setInterval(() => void refreshToken(), 90 * 60 * 1000);

        const onVisible = () => {
          if (document.visibilityState === "visible" && Date.now() - lastMintAt > 60 * 60 * 1000) {
            void refreshToken();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        removeVisibilityListener = () =>
          document.removeEventListener("visibilitychange", onVisible);
      } catch (error) {
        if (cancelled) return;
        setTokenError(error instanceof Error ? error.message : "Could not connect to the room");
        setStatus("disconnected");
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      removeVisibilityListener?.();
      created?.destroy();
      ydoc.destroy();
    };
  }, [attempt, slug, viewKey, shareToken]);

  useEffect(() => {
    if (!doc) return;

    const text = doc.getText(Y_TEXT_KEY);
    const update = () => {
      const room = text.toString();
      sharedCodeRef.current = room;
      setSharedCode(room);

      if (!canEdit && !readonlySeededRef.current && room.length > 0) {
        readonlySeededRef.current = true;
        codeRef.current = room;
        setCode(room);
        setChars(room.length);
      }
    };

    text.observe(update);
    update();

    return () => text.unobserve(update);
  }, [doc, canEdit]);

  const onReady = useCallback((next: Editor) => setEditor(next), []);

  const onSelectionChange = useCallback((text: string) => setSelection(text), []);

  const onCodeChange = useCallback(
    (text: string) => {
      codeRef.current = text;
      setChars(text.length);
      if (canEdit) saveLocalCode(slug, clientIdRef.current, text);
    },
    [canEdit, slug],
  );

  const selectAll = useCallback(() => {
    const model = editor?.getModel();
    if (!editor || !model) return;
    editor.setSelection(model.getFullModelRange());
    editor.focus();
  }, [editor]);

  const changeLanguage = (value: string) => {
    if (!isLanguage(value)) return;
    setLanguage(value);
    setStoredLanguage(slug, value);
  };

  async function renameRoom() {
    if (role !== "owner") return;

    const next = window.prompt("Room title", title)?.trim();
    if (!next || next === title) return;

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: next }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not rename the room");

      setTitle(next);
      showToast("Room renamed");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not rename the room");
    }
  }

  async function copy(text: string, message: string) {
    try {
      await writeClipboard(text);
      showToast(message);
    } catch {
      showToast("Could not copy to the clipboard");
    }
  }

  function formatDocument() {
    if (!canEdit) return;

    const current = codeRef.current;
    const formatted = formatCode(current, language);
    if (formatted === current) {
      showToast("Already formatted");
      return;
    }

    codeRef.current = formatted;
    setCode(formatted);
    setChars(formatted.length);
    saveLocalCode(slug, clientIdRef.current, formatted);
    showToast("Code formatted");
  }

  function download() {
    const blob = new Blob([codeRef.current], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${slugify(title)}.${FILE_EXTENSIONS[language] ?? "txt"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const pushCode = useCallback(() => {
    if (!doc || !canEdit || status !== "connected") return;

    const next = codeRef.current;
    if (next.length > MAX_CODE_CHARS) {
      setSyncError(`Local code is limited to ${MAX_CODE_CHARS.toLocaleString()} characters.`);
      return;
    }

    const text = doc.getText(Y_TEXT_KEY);
    doc.transact(() => {
      text.delete(0, text.length);
      if (next) text.insert(0, next);
    }, "prototype-push");

    sharedCodeRef.current = next;
    setSharedCode(next);
    saveLocalCode(slug, clientIdRef.current, next);
    setSyncError(null);
    showToast("Pushed local code to the room");
  }, [canEdit, doc, showToast, slug, status]);

  const pullCode = useCallback(() => {
    if (!doc || status !== "connected") return;

    const room = doc.getText(Y_TEXT_KEY).toString();
    codeRef.current = room;
    sharedCodeRef.current = room;
    setCode(room);
    setSharedCode(room);
    setChars(room.length);
    if (canEdit) saveLocalCode(slug, clientIdRef.current, room);
    setSyncError(null);
    showToast(canEdit ? "Pulled room code into local draft" : "Room code refreshed");
  }, [canEdit, doc, showToast, slug, status]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const moveResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    const bounds = splitRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPanelWidth(clampPanelWidth(bounds.right - event.clientX - RESIZER_WIDTH / 2));
  }, []);

  const stopResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPanelWidth((current) => clampPanelWidth(current + 16));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPanelWidth((current) => clampPanelWidth(current - 16));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPanelWidth(MIN_PANEL_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      setPanelWidth((current) => clampPanelWidth(MAX_PANEL_WIDTH));
    }
  }, []);

  const expiry = expiryLabel(expiresAt);

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line px-2.5 py-2 sm:gap-3 sm:px-4">
        <Link href="/" className="icon-btn" title="CodEX home" aria-label="CodEX home">
          <IconCode width={17} height={17} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>

            {role === "owner" ? (
              <button
                type="button"
                onClick={() => void renameRoom()}
                className="icon-btn size-7 shrink-0"
                title="Rename room"
                aria-label="Rename room"
              >
                <IconPencil width={13} height={13} />
              </button>
            ) : null}

            {!canEdit ? (
              <span className="chip shrink-0 border-warning/30 text-warning">
                <IconEye width={11} height={11} />
                Read-only
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
            <StatusPill status={status} synced={synced} error={tokenError} />
            <span aria-hidden>·</span>
            <span className="truncate">{LANGUAGE_LABELS[language]}</span>
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="hidden sm:inline">{chars.toLocaleString()} chars</span>
            {expiry ? (
              <>
                <span className="hidden md:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden md:inline">{expiry}</span>
              </>
            ) : null}
          </div>
        </div>

        <select
          className="input hidden h-9 w-auto py-1.5 text-xs md:block"
          value={language}
          onChange={(event) => changeLanguage(event.target.value)}
          disabled={!canEdit}
          aria-label="Language"
          title={canEdit ? "Language for this browser" : "Language is set by the room creator"}
        >
          {LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {LANGUAGE_LABELS[value]}
            </option>
          ))}
        </select>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="btn btn-ghost h-9 gap-1.5 px-2.5"
            title="Share this room"
          >
            <IconShare width={15} height={15} />
            <span className="hidden lg:inline">Share</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={download}
          className="icon-btn hidden sm:inline-flex"
          title="Download the local code"
          aria-label="Download the local code"
        >
          <IconDownload width={16} height={16} />
        </button>

        <span className="hidden sm:inline-flex">
          <ThemeToggle />
        </span>
      </header>

      {tokenError ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          <span>{tokenError}</span>
          <button
            type="button"
            className="btn btn-ghost h-8 border-danger/30 px-2.5 text-danger"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry connection
          </button>
        </div>
      ) : null}

      <main
        ref={splitRef}
        className="room-split"
        style={{ "--panel-width": `${panelWidth}px` } as CSSProperties}
      >
        <section
          id="room-editor"
          className="room-editor relative min-h-0 border-b border-line lg:border-b-0"
        >
          <CodeEditor
            language={language}
            readOnly={!canEdit}
            value={code}
            onReady={onReady}
            onSelectionChange={onSelectionChange}
            onChange={onCodeChange}
          />

          {canEdit ? (
            <button
              type="button"
              onClick={formatDocument}
              className="btn btn-soft absolute top-3 right-4 z-10 h-8 gap-1.5 px-2.5 text-xs shadow-lg"
              title={`Pretty print ${LANGUAGE_LABELS[language]} code`}
            >
              <IconFormat width={14} height={14} />
              Format
            </button>
          ) : null}

          {!canEdit ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel/95 px-3 py-1.5 text-[11px] text-muted shadow-lg backdrop-blur">
              Read-only view — use Pull to refresh
            </div>
          ) : null}
        </section>

        <div
          className="room-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and side panel"
          aria-controls="room-editor room-side-panel"
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={MAX_PANEL_WIDTH}
          aria-valuenow={panelWidth}
          tabIndex={0}
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={onResizeKeyDown}
        >
          <span aria-hidden="true" />
        </div>

        <aside id="room-side-panel" className="room-side flex min-h-0 flex-col bg-elevated">
          <div className="flex shrink-0 gap-1 border-b border-line p-2">
            <button
              type="button"
              className="btn btn-ghost flex-1 gap-1.5 px-2 data-[active=true]:bg-panel2 data-[active=true]:text-fg"
              data-active={panel === "ai"}
              onClick={() => setPanel("ai")}
            >
              AI
            </button>
            <button
              type="button"
              className="btn btn-ghost flex-1 gap-1.5 px-2 data-[active=true]:bg-panel2 data-[active=true]:text-fg"
              data-active={panel === "chat"}
              onClick={() => setPanel("chat")}
            >
              Chat
            </button>
            <button
              type="button"
              className="btn btn-ghost flex-1 gap-1.5 px-2 data-[active=true]:bg-panel2 data-[active=true]:text-fg"
              data-active={panel === "sync"}
              onClick={() => setPanel("sync")}
            >
              <IconLink width={14} height={14} />
              Push / Pull
            </button>
          </div>

          <div className={`min-h-0 flex-1 ${panel === "chat" ? "p-3" : "overflow-y-auto p-3"}`}>
            {panel === "ai" ? (
              <AiPanel
                roomSlug={slug}
                language={language}
                selection={selection}
                token={token}
                onSelectAll={selectAll}
              />
            ) : panel === "chat" ? (
              <ChatPanel provider={provider} status={status} name={userName} />
            ) : (
              <PushPullPanel
                canEdit={canEdit}
                connected={status === "connected"}
                localChars={chars}
                sharedChars={sharedCode.length}
                busy={false}
                error={syncError}
                onPush={pushCode}
                onPull={pullCode}
              />
            )}
          </div>
        </aside>
      </main>

      <div className="sr-only" aria-live="polite">
        {toast ?? ""}
      </div>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm shadow-2xl">
          {toast}
        </div>
      ) : null}

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        slug={slug}
        token={token}
        onCopied={showToast}
      />
    </div>
  );
}

function StatusPill({
  status,
  synced,
  error,
}: {
  status: ConnectionStatus;
  synced: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <span className="size-1.5 rounded-full bg-danger" />
        Offline
      </span>
    );
  }

  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <span className="size-1.5 rounded-full bg-success" />
        {synced ? "Live" : "Syncing"}
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 text-accent">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" />
        Connecting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-warning">
      <span className="size-1.5 rounded-full bg-warning" />
      Reconnecting
    </span>
  );
}
