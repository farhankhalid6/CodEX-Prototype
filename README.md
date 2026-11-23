# CodEX Prototype

A stripped-down CodEX build: one code room, an AI explainer, email-free chat, and
**explicit push / pull** code sync. It is published from a separate public repo so
the main CodEX application and its Vercel deployment stay untouched.

This prototype is free to run: Vercel Hobby for the web app, Supabase Free for
Postgres/Auth, the existing free Render realtime service, GitHub Actions for
cleanup/keep-warm, and watsonx.ai for the explainer. No credit card, no IBM Code
Engine, and no paid container host are required.

## What is included

| Area         | Behaviour                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| Editor       | Monaco with a **private browser draft** in `localStorage`                  |
| Code sync    | Push writes the draft to the room; Pull replaces the draft from the room   |
| Languages    | `java`, `html`, `c`, `cpp`, `javascript`, `markdown` (`md`), `sql`, `text` |
| AI explainer | Explain, find bugs, suggest comments — streamed and **read-only**          |
| Chat         | Live WebSocket chat for link holders — no email or account needed          |
| Sharing      | Viewer / commentor / editor links, signed room tokens, expiring rooms      |
| Dashboard    | Signed-in room list with search, rename and delete                         |
| Ops          | Health endpoints, cleanup job, keep-warm workflow                          |

## What is intentionally removed

- Live code preview and browser-side execution
- Run button, runner service, Piston/runtime catalogs and `/api/run`
- Versions / snapshots, restore, COS mirror and snapshot downloads
- Full Git workflow (branches, commits, pull requests, merges, cherry-pick)
- AI merge reviewer
- Auto-detected language writes and automatic Yjs↔Monaco binding
- Presence UI and remote cursors

The AI panel never applies its output. Selected code is treated as untrusted
data, not as instructions. Only an explicit **Push** changes the shared room
code, and only an explicit **Pull** changes the local editor.

## Architecture

```text
Browser ──HTTPS──► Next.js web (apps/web) ──► Supabase Postgres + Auth
   │                     │
   │                     └──► watsonx.ai (Granite, streaming SSE)
   │
   └──WSS──► codeshare-realtime (existing Render free service)
                    Yjs room state + chat messages + signed token checks
                    debounced persistence to Supabase (service role)
```

### Repository layout

```text
apps/web          Next.js app, API routes, editor, AI panel, chat, push/pull UI
apps/realtime     Yjs WebSocket server (unchanged protocol, shared env names)
packages/shared   Languages, constants, schemas, room/share token helpers
jobs/cleanup      Deletes expired rooms and old AI rows
deploy            Free deployment guide
docs              Prototype-focused notes
```

## Local development

Requirements: Node 22+, npm, Supabase project, and a
`ROOM_TOKEN_SECRET` of at least 32 characters.

```bash
npm ci
cp .env.example .env
# fill in .env — never commit it
npm run build -w @codex/shared
npm run dev
```

Default local URLs:

- Web: <http://localhost:3000>
- Realtime: `ws://localhost:8080/ws`

Useful scripts:

```bash
npm run format:check
npm run typecheck
npm test
npm run build
npm run models:list   # optional: list watsonx models available to your space
```

## Push / pull semantics

1. On load, an editor gets an empty private draft (or the last draft saved in
   that browser).
2. Typing updates only the local draft and `localStorage`.
3. **Push local code to room** replaces the shared Y.Text with the draft. It is
   disabled for viewers/commentors and while offline.
4. **Pull room code to local** replaces the draft with the current shared text.
   It is safe for read-only links.
5. Chat and AI remain live regardless of code sync state.

Language selection is also browser-local and never rewrites shared code.

## Roles and tokens

- `owner`: room creator; can rename and share.
- `editor`: can edit the local draft and push.
- `commentor`: can chat; cannot push.
- `viewer`: read-only; can pull and chat without sign-in.

Room and share tokens are signed with `ROOM_TOKEN_SECRET` using `jose`. The
realtime server verifies the same secret before accepting a WebSocket upgrade.
Keep the identifier and env names as `ROOM_TOKEN_SECRET`, `codeshare-*`, etc.;
only the product name shown to users is CodEX.

## API surface

| Endpoint                             | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| `GET /api/health`                    | Database/AI/realtime health summary      |
| `POST /api/rooms`                    | Create a room                            |
| `GET/PATCH/DELETE /api/rooms/[slug]` | Load, rename, delete                     |
| `POST /api/rooms/[slug]/token`       | Mint a short-lived realtime room token   |
| `POST /api/rooms/[slug]/share`       | Mint viewer/commentor/editor links       |
| `POST /api/rooms/[slug]/fork`        | Fork a room                              |
| `POST /api/ai`                       | Streaming AI explanation (never applies) |
| `GET /auth/callback`                 | Supabase magic-link callback             |

## Environment variables

See `.env.example`. The active groups are:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- Tokens/URLs: `ROOM_TOKEN_SECRET`, `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_REALTIME_URL`, `REALTIME_ALLOWED_ORIGINS`
- watsonx.ai: `WATSONX_API_KEY`, `WATSONX_SPACE_ID` (or `WATSONX_PROJECT_ID`),
  `WATSONX_MODEL_ID`, optional model tuning vars
- Limits: `AI_*`, `ROOM_CREATE_LIMIT_PER_HOUR`, realtime `MAX_*`,
  `ANON_ROOM_TTL_DAYS`, `AI_REQUEST_RETENTION_DAYS`

`COS_*`, `RUNNER_*`, `SNAPSHOT_KEEP_PER_ROOM` and related keys are not used by
this prototype.

## Deployment

See `deploy/free-stack.md`. The prototype uses a new Vercel project
(`codeshare-prototype-web`) and reuses the existing `codeshare-realtime` Render
service; do not create a second paid or free realtime instance.
