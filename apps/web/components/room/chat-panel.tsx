"use client";

import { useEffect, useRef, useState } from "react";
import {
  CHAT_KEEP_PER_ROOM,
  CHAT_MESSAGE_MAX_CHARS,
  decodeChat,
  encodeChat,
  type ChatEntry,
} from "@codex/shared";
import { IconArrowRight, IconChat } from "@/components/icons";

interface Props {
  provider: { ws: WebSocket | null } | null;
  status: string;
  name: string;
}

const CHAT_COLORS = ["#0a84ff", "#32d74b", "#bf5af2", "#ff9f0a", "#64d2ff", "#ff375f"];

function colorFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return CHAT_COLORS[hash % CHAT_COLORS.length] ?? CHAT_COLORS[0]!;
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ provider, status, name }: Props) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ws = provider?.ws;
    if (!ws) return;

    const onMessage = (event: MessageEvent) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const payload = decodeChat(new Uint8Array(event.data));
      if (!payload) return;

      if (payload.kind === "history") {
        setMessages(payload.messages.slice(-CHAT_KEEP_PER_ROOM));
        return;
      }

      setMessages((previous) =>
        previous.some((item) => item.id === payload.entry.id)
          ? previous
          : [...previous.slice(-(CHAT_KEEP_PER_ROOM - 1)), payload.entry],
      );
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [provider, status]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text) return;

    const ws = provider?.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Chat reconnects with the room. Try again in a moment.");
      return;
    }

    const entry: ChatEntry = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 40) || "Guest",
      text: text.slice(0, CHAT_MESSAGE_MAX_CHARS),
      at: new Date().toISOString(),
    };

    try {
      ws.send(encodeChat({ kind: "message", entry }));
      setMessages((previous) => [...previous.slice(-(CHAT_KEEP_PER_ROOM - 1)), entry]);
      setDraft("");
      setError(null);
    } catch {
      setError("Could not send the message.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <IconChat width={15} height={15} className="text-accent" />
          Room chat
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
          <span
            className={`size-1.5 rounded-full ${status === "connected" ? "bg-success" : "bg-warning"}`}
          />
          {status === "connected" ? "Live" : "Connecting"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-xs leading-relaxed text-muted">
            No messages yet. No email needed — chat is live for everyone in this room and clears
            when the room closes.
          </p>
        ) : null}

        {messages.map((message) => {
          const own = message.name === name.trim();
          return (
            <div key={message.id} className={`flex flex-col ${own ? "items-end" : "items-start"}`}>
              <div className="flex items-baseline gap-1.5 px-1 text-[10px] text-muted">
                <span style={{ color: colorFor(message.name) }}>{message.name}</span>
                <span>{timeLabel(message.at)}</span>
              </div>
              <div
                className={`mt-0.5 max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                  own ? "bg-accent-strong text-white" : "border border-line bg-panel"
                }`}
              >
                {message.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error ? <p className="pb-1 text-[11px] text-danger">{error}</p> : null}

      <div className="flex shrink-0 items-end gap-2 border-t border-line pt-3">
        <textarea
          className="input max-h-24 min-h-10 flex-1 resize-none py-2.5 text-xs"
          rows={1}
          value={draft}
          maxLength={CHAT_MESSAGE_MAX_CHARS}
          placeholder="Message the room…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="btn btn-primary size-10 shrink-0 p-0"
          onClick={send}
          disabled={!draft.trim() || status !== "connected"}
          aria-label="Send message"
          title="Send message"
        >
          <IconArrowRight width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
