# CodEX Prototype — technical overview

This document describes the **prototype** only. The main CodEX application has
more features; none of them are implied here.

## Product scope

CodEX Prototype has four user-facing job stories:

1. Create or join a link-based room.
2. Edit a private Monaco draft locally.
3. Push that draft to the room, or pull the room code back into the draft, on
   demand.
4. Ask watsonx.ai about a selection and chat with everyone in the room — no email needed.

There is no code execution, live preview, version history, COS snapshot mirror,
remote-cursor UI, or Git branch/commit/PR workflow. The AI never edits code.

## Supported languages

`LANGUAGES` in `packages/shared/src/languages.ts` is the single source of truth:

| ID           | Label      | Extension |
| ------------ | ---------- | --------- |
| `java`       | Java       | `.java`   |
| `html`       | HTML       | `.html`   |
| `c`          | C          | `.c`      |
| `cpp`        | C++        | `.cpp`    |
| `javascript` | JavaScript | `.js`     |
| `markdown`   | md         | `.md`     |
| `sql`        | SQL        | `.sql`    |
| `plaintext`  | text       | `.txt`    |

`detectLanguage()` is used only for a best-effort initial suggestion; it no
longer writes a detected language into shared room metadata. The selected
language is stored per room in the browser.

## Components

| Package / app     | Responsibility                                                       |
| ----------------- | -------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 App Router web app and API route handlers                 |
| `apps/realtime`   | Node `ws` + `y-websocket` compatible server for room state and chat  |
| `packages/shared` | Language catalog, constants, Zod schemas, JWT helpers, chat encoding |
| `jobs/cleanup`    | Scheduled deletion of expired rooms and old AI rows                  |

### Web app

The room page is a server component that:

- loads the room with the Supabase service role,
- resolves `owner` / `editor` / `commentor` / `viewer` from session, `view` key,
  or signed `access` token,
- passes `role`, `canEdit`, `viewKey` and `shareToken` to `RoomClient`.

`RoomClient` owns:

- the Yjs `WebsocketProvider` connection and short-lived token refresh,
- a `Y.Text` observer used only for the **shared code character count** and for
  read-only link refresh,
- local draft state in `localStorage` (`loadLocalCode` / `saveLocalCode`),
- push / pull callbacks that explicitly rewrite `Y.Text` or the local draft,
- the AI, chat and push/pull tab panels.

Monaco is deliberately **not** bound to the shared `Y.Text`. `CodeEditor`
receives `value` and `onChange`, so remote Yjs updates cannot move the caret or
silently replace local text.

### AI panel

`POST /api/ai` accepts `roomId`, `code`, `action` and `language`, validates the
request with `aiRequestSchema`, applies per-user/IP limits, then streams a
watsonx.ai response as SSE. Actions are `explain`, `bugs` and `comments`.

Safety rules:

- code inside `<user_code>` is untrusted data and never a prompt instruction,
- the prompt forbids claims that the AI edited, saved or ran anything,
- the UI exposes Copy and Select all only; there is no Apply/Insert action,
- the former Git AI merge-review route is not part of this prototype.

### Realtime server

`apps/realtime` keeps the existing `codeshare-*` protocol and environment names:

- verifies signed room tokens from `ROOM_TOKEN_SECRET`,
- accepts Yjs sync/awareness messages and CodEX chat frames,
- persists debounced Yjs room state to Supabase with the service role,
- rejects upgrades from origins outside `REALTIME_ALLOWED_ORIGINS`.

Because chat uses the same WebSocket, every valid room participant can chat
without an email or account, and no code auto-sync is involved. The room token's
`signedIn` claim is used only as the realtime server's chat-capability flag in
this prototype.

## Data model used by this prototype

| Table         | Use                                                         |
| ------------- | ----------------------------------------------------------- |
| `rooms`       | Title, language, visibility, owner, expiry, Yjs state, text |
| `ai_requests` | Audit rows for AI actions, trimmed by retention job         |
| `profiles`    | Display names for signed-in users                           |

Snapshot tables and COS objects are not read or written. The cleanup job only
counts/deletes expired rooms and old `ai_requests`.

## Environment groups

Keep infra identifiers and env names unchanged:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `ROOM_TOKEN_SECRET` (32+ characters; shared with realtime)
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REALTIME_URL`,
  `REALTIME_ALLOWED_ORIGINS`
- `WATSONX_*`
- `AI_*`, `ROOM_CREATE_LIMIT_PER_HOUR`
- realtime `PORT`, `MAX_*`, `ROOM_IDLE_EVICT_MS`, `SAVE_DEBOUNCE_MS`,
  `LOG_LEVEL`
- cleanup `ANON_ROOM_TTL_DAYS`, `AI_REQUEST_RETENTION_DAYS`

Removed: `COS_*`, `RUNNER_*`, `SNAPSHOT_KEEP_PER_ROOM`.

## CI and operations

- `.github/workflows/ci.yml` runs format check, typecheck, tests and build on
  Node 22 with dummy env values.
- `.github/workflows/cleanup.yml` runs the cleanup job daily at 03:00 UTC.
- `.github/workflows/keepalive.yml` pings the web and realtime health endpoints
  every 10 minutes so the free Render instance stays warm.

The production main deployment and its Vercel project are separate and must not
be modified by prototype work.
