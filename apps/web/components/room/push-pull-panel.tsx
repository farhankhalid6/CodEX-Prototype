"use client";

import { IconArrowRight, IconDownload, IconLink, IconLock } from "@/components/icons";

interface Props {
  canEdit: boolean;
  connected: boolean;
  localChars: number;
  sharedChars: number;
  busy: boolean;
  error: string | null;
  onPush: () => void;
  onPull: () => void;
}

export function PushPullPanel({
  canEdit,
  connected,
  localChars,
  sharedChars,
  busy,
  error,
  onPush,
  onPull,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <IconLink width={15} height={15} className="text-accent" />
            Push / Pull
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Explicit code sync only</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
          <span className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`} />
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Local draft</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{localChars.toLocaleString()}</p>
          <p className="text-[10px] text-muted">characters</p>
        </div>
        <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Room code</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{sharedChars.toLocaleString()}</p>
          <p className="text-[10px] text-muted">characters</p>
        </div>
      </div>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary h-10 w-full gap-1.5"
          onClick={onPush}
          disabled={!canEdit || !connected || busy}
          title={canEdit ? "Publish your local draft to the room" : "Read-only links cannot push"}
        >
          {canEdit ? (
            <IconArrowRight width={15} height={15} />
          ) : (
            <IconLock width={14} height={14} />
          )}
          Push local code to room
        </button>
        <button
          type="button"
          className="btn btn-soft h-10 w-full gap-1.5"
          onClick={onPull}
          disabled={!connected || busy}
          title="Replace your local draft with the current room code"
        >
          <IconDownload width={15} height={15} />
          Pull room code to local
        </button>
      </div>

      <div className="rounded-xl border border-line bg-elevated px-3 py-3 text-[11px] leading-relaxed text-muted">
        Your editor is a private local draft. It only changes when you edit here or pull. The room
        code only changes when an editor pushes. Chat and the AI panel stay live.
      </div>
    </div>
  );
}
