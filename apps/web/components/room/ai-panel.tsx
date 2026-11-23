"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_ACTION_HINTS, AI_ACTION_LABELS, AI_ACTIONS, type AiAction } from "@codex/shared";
import { IconCopy, IconSparkles, IconStop } from "@/components/icons";
import { MarkdownLite } from "./markdown-lite";

interface Props {
  roomSlug: string;
  language: string;
  selection: string;
  token: string | null;
  onSelectAll: () => void;
}

type Status = "idle" | "streaming" | "error";

interface StreamEvent {
  type: "delta" | "done" | "error";
  text?: string;
  message?: string;
  retryAfterSeconds?: number;
}

export function AiPanel({ roomSlug, language, selection, token, onSelectAll }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const run = useCallback(
    async (action: AiAction) => {
      if (!token || !selection.trim() || status === "streaming") return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("streaming");
      setOutput("");
      setError(null);
      setCopied(false);

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roomId: roomSlug,
            code: selection,
            action,
            language,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            retryAfterSeconds?: number;
          };

          if (response.status === 429) {
            const minutes = data.retryAfterSeconds
              ? Math.max(1, Math.ceil(data.retryAfterSeconds / 60))
              : 10;
            throw new Error(
              data.error ?? `Rate limit reached. Try again in about ${minutes} minutes.`,
            );
          }

          throw new Error(data.error ?? `The AI request failed (${response.status})`);
        }

        if (!response.body) throw new Error("The server returned an empty response");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const raw = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const data = raw
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");

            if (data) {
              let event: StreamEvent | null = null;
              try {
                event = JSON.parse(data) as StreamEvent;
              } catch {
                event = null;
              }

              if (event?.type === "delta" && event.text) {
                setOutput((previous) => previous + event.text);
              } else if (event?.type === "error") {
                throw new Error(event.message ?? "The model call failed");
              } else if (event?.type === "done") {
                finished = true;
              }
            }

            boundary = buffer.indexOf("\n\n");
          }
        }

        setStatus("idle");
      } catch (caught) {
        if (controller.signal.aborted) {
          setStatus("idle");
          return;
        }

        setStatus("error");
        setError(caught instanceof Error ? caught.message : "The AI request failed");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [language, roomSlug, selection, status, token],
  );

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }

  async function copy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const busy = status === "streaming";
  const hasSelection = selection.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <IconSparkles width={15} height={15} className="text-accent" />
            AI explainer
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Granite on watsonx.ai</p>
        </div>

        {output ? (
          <button
            type="button"
            className="icon-btn size-8"
            onClick={() => void copy()}
            title={copied ? "Copied" : "Copy answer"}
            aria-label={copied ? "Copied" : "Copy answer"}
          >
            <IconCopy width={14} height={14} />
          </button>
        ) : null}
      </div>

      {!hasSelection ? (
        <div className="rounded-xl border border-dashed border-line px-3 py-5 text-center">
          <p className="text-sm font-medium">Select some code</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Highlight a function, a block, or the whole file. The selection is sent to watsonx.ai;
            the document is never changed.
          </p>
          <button type="button" className="btn btn-soft mt-3" onClick={onSelectAll}>
            Select the whole file
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px] text-muted">
            <span>{selection.length.toLocaleString()} characters selected</span>
            <span className="font-mono">{language}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {AI_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                className="btn btn-soft px-2 py-2 text-xs"
                title={AI_ACTION_HINTS[action]}
                onClick={() => void run(action)}
                disabled={busy || !token}
              >
                {AI_ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          {busy ? (
            <button type="button" className="btn btn-ghost" onClick={stop}>
              <IconStop width={13} height={13} />
              Stop generating
            </button>
          ) : null}
        </>
      )}

      {!token && !error ? (
        <p className="text-xs text-muted">Waiting for the room connection…</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-xs leading-relaxed text-danger">
          {error}
        </div>
      ) : null}

      {output ? (
        <div className="rounded-xl border border-line bg-panel p-3">
          <MarkdownLite text={output} />
          {busy ? (
            <span className="mt-2 inline-block size-1.5 animate-pulse rounded-full bg-accent" />
          ) : null}
        </div>
      ) : busy ? (
        <div className="space-y-2 rounded-xl border border-line bg-panel p-3">
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-panel2" />
          <div className="h-2.5 w-full animate-pulse rounded bg-panel2" />
          <div className="h-2.5 w-5/6 animate-pulse rounded bg-panel2" />
          <p className="pt-1 text-[11px] text-muted">Reading the selection…</p>
        </div>
      ) : null}

      <p className="mt-auto border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
        The model can be wrong. Answers are suggestions only and are never applied to your code.
        Selected code is treated as untrusted input.
      </p>
    </div>
  );
}
