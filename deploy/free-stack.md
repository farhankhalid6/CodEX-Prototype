# Free deployment — CodEX Prototype

This prototype is deliberately deployable on free tiers only. It does not need
an IBM Cloud billable account, Code Engine, a container registry, or a card.

| Piece     | Host                 | Free tier detail                                               |
| --------- | -------------------- | -------------------------------------------------------------- |
| Web + API | Vercel Hobby         | Next.js serverless functions, no card required                 |
| Realtime  | Existing Render free | Reuse `codeshare-realtime`; do **not** create a second service |
| Database  | Supabase Free        | Postgres + Auth; GitHub Actions keep the project active        |
| AI        | watsonx.ai           | Existing IAM key + deployment space                            |
| Cleanup   | GitHub Actions       | Daily scheduled job                                            |
| Keep-warm | GitHub Actions       | HTTP pings every 10 minutes                                    |

## 1. Repository

The prototype lives in its own public repo:

```text
https://github.com/farhankhalid6/CodEX-Prototype
```

The main CodEX repository and its Vercel project are not changed by prototype
work. Product-facing copy says **CodEX**; infra identifiers stay `codeshare-*`.

## 2. Reuse the existing realtime service

`render.yaml` already defines the single free Render service:

```text
codeshare-realtime
wss://codeshare-realtime.onrender.com/ws
```

Do not deploy another realtime instance. One free instance running all month is
close to the 750 included instance-hours; two would exceed the allowance.

After the prototype Vercel deployment has a stable host, add that exact origin
to the Render service env var:

```text
REALTIME_ALLOWED_ORIGINS=https://codeshare-web-kappa.vercel.app,https://codeshare-prototype-web.vercel.app
```

No trailing slash. A WebSocket upgrade from any other origin is rejected with
`403`. The realtime server and the web app must use the same
`ROOM_TOKEN_SECRET`, otherwise upgrades receive `401`.

## 3. Create the prototype Vercel project

1. In Vercel, **Add New → Project** and import `CodEX-Prototype`.
2. Set **Root Directory** to `apps/web`.
3. Use a `codeshare-*` project name, for example `codeshare-prototype-web`.
4. Build settings come from `apps/web/vercel.json`: install the monorepo lockfile,
   build `@codex/shared`, then build Next.js.
5. Copy the environment variables from the existing CodEX Vercel project into
   the new one, using the dashboard's **Copy environment variables** action or
   the Vercel CLI/API. Never paste values into chat, issues or logs.
6. Set/keep these prototype-specific values:
   - `NEXT_PUBLIC_SITE_URL` → the prototype deployment origin
   - `NEXT_PUBLIC_REALTIME_URL` → `wss://codeshare-realtime.onrender.com/ws`
   - `REALTIME_ALLOWED_ORIGINS` → include the prototype origin (see step 2)

### Variables that must exist

Build-time / public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_REALTIME_URL`

Runtime / secret:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ROOM_TOKEN_SECRET`
- `WATSONX_API_KEY`
- `WATSONX_SPACE_ID` (or `WATSONX_PROJECT_ID`)
- `WATSONX_MODEL_ID`

Optional runtime values can be copied as-is: `WATSONX_URL`,
`WATSONX_API_VERSION`, `WATSONX_API_STYLE`, `WATSONX_MAX_NEW_TOKENS`,
`IP_HASH_SALT`, the `AI_*` limits and `ROOM_CREATE_LIMIT_PER_HOUR`.

The prototype does **not** use `COS_*`, `RUNNER_*` or
`SNAPSHOT_KEEP_PER_ROOM`. They do not need to be copied.

## 4. Supabase and auth URLs

Use the same Supabase project as the main app unless you deliberately create a
separate free project. If you reuse it, add the prototype URLs in
**Authentication → URL Configuration**:

- Site URL: `https://codeshare-prototype-web.vercel.app`
- Redirect URL: `https://codeshare-prototype-web.vercel.app/auth/callback`

Keep the existing production URLs as well so the main deployment keeps working.
Apply the same rooms/RLS schema as documented in
`docs/CodEX-tech-overview.md`; no snapshot tables are required by the prototype.

## 5. GitHub Actions

For the prototype repo, add repository variables:

| Name                  | Value                                                   |
| --------------------- | ------------------------------------------------------- |
| `WEB_HEALTH_URL`      | `https://codeshare-prototype-web.vercel.app/api/health` |
| `REALTIME_HEALTH_URL` | `https://codeshare-realtime.onrender.com/health`        |

Add repository secrets (values copied from the existing project, never printed):

| Name                        | Value                     |
| --------------------------- | ------------------------- |
| `SUPABASE_URL`              | Same Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Same service-role key     |

`.github/workflows/cleanup.yml` deletes expired rooms and old AI rows only.
`.github/workflows/keepalive.yml` pings both health endpoints every 10 minutes.

## 6. Verify

```bash
curl https://codeshare-prototype-web.vercel.app/api/health
curl https://codeshare-realtime.onrender.com/health
```

The web response should show `"database":true` and `"aiConfigured":true`. The
realtime response should show `"ok":true`. Then open the same room in two
windows:

- chat stays live for link holders without an email or account,
- typing in one window does **not** change the other editor,
- pressing **Push** in one window updates the room text,
- pressing **Pull** in the other window updates that local draft,
- an AI answer never edits either editor.

## Troubleshooting

| Symptom                                           | Likely cause                                                   |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Realtime health takes ~1 minute                   | Render free instance was cold; keep-warm should prevent this   |
| Editor stays “Connecting”                         | Wrong `NEXT_PUBLIC_REALTIME_URL`                               |
| `403` on WebSocket upgrade                        | Prototype origin missing from `REALTIME_ALLOWED_ORIGINS`       |
| `401` on WebSocket upgrade                        | `ROOM_TOKEN_SECRET` differs between Vercel and Render          |
| AI returns `503`                                  | Missing `WATSONX_API_KEY` or `WATSONX_SPACE_ID` on Vercel      |
| AI returns `no_associated_service_instance_error` | Space has no Runtime instance attached                         |
| Magic-link email never arrives                    | Prototype `/auth/callback` not added to Supabase redirect URLs |

## Why no Code Engine?

Code Engine requires a paid/billable IBM Cloud account and is unavailable on a
trial account. This prototype intentionally ships no Code Engine, Docker or
paid-container path. Vercel + the existing free Render service cover compute
without a card.
