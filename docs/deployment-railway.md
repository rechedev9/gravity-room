# Railway deployment

> **HISTORICAL — superseded.** Gravity Room has migrated off Railway to a single
> same-origin Vercel project (Neon Postgres + Upstash Redis, serverless Elysia via
> `app.fetch`). This document is retained only as a record of the old Railway
> topology and is no longer accurate for deploys. For the current go-live
> procedure see [`VERCEL_CUTOVER.md`](./VERCEL_CUTOVER.md).

The web SPA + API + Postgres + Redis run on a single Railway project. Web SPA static-served by Railpack; API runs on Bun via Railpack with the Bun-workspace shared-monorepo pattern.

## Project topology

| Service    | Type           | Builder                               |
| ---------- | -------------- | ------------------------------------- |
| `Postgres` | Managed plugin | Railway `postgres-ssl:18` template    |
| `Redis`    | Managed plugin | Railway `redis:8.2.1` template        |
| `api`      | Bun + Elysia   | Railpack (Bun-workspace, shared root) |
| `web`      | React/Vite SPA | Railpack (static SPA fallback)        |

Project ID: `7936f57f-711c-472a-9e13-7d0e931610d6`. Production environment: `73cfed4d-edb5-4e2d-8f46-435a44ae3a5a`.

## Service config

Both app services build from the **repo root**, not their sub-app directory — the Bun workspace lockfile is at the root and `@gzclp/domain` is a `workspace:*` dependency, so each service needs the full repo context.

### `api`

- `build.buildCommand = bun install`
- `deploy.startCommand = bun run --filter api start`
- `deploy.healthcheckPath = /health`
- `deploy.healthcheckTimeout = 300` (cold-DB migrations + reference seeds take ~30–60s)
- `build.watchPatterns = ["apps/backend/api/**", "packages/domain/**", "bun.lock", "package.json"]`

The `bun run --filter api start` runs `bun src/index.ts` which imports `bootstrap.ts`. Bootstrap runs Drizzle migrations (and the goose-bridge hotfix, gated behind a `schemaExists` check so it's a no-op on fresh DBs), runs reference data seeds (muscle groups, exercises, program templates), then `app.listen(PORT)`.

### `web`

- `build.buildCommand = bun install && bun run --filter web build`
- `RAILPACK_SPA_OUTPUT_DIR = apps/frontend/web/dist` (variable, NOT a buildCommand override) — tells Railpack to serve the Vite output as a static SPA with client-side routing fallback
- No `startCommand` — Railpack uses its built-in static server when `RAILPACK_SPA_OUTPUT_DIR` is set
- `build.watchPatterns = ["apps/frontend/web/**", "packages/domain/**", "bun.lock", "package.json"]`

## Variables

### `api`

| Variable            | Value                                         | Notes                                                       |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`      | `${{Postgres.DATABASE_URL}}`                  | Internal DNS, no egress cost                                |
| `REDIS_URL`         | `${{Redis.REDIS_URL}}`                        | Internal DNS                                                |
| `JWT_SECRET`        | 96-char random hex                            | Generated once; rotate by replacing                         |
| `CORS_ORIGIN`       | `https://web-production-9db61.up.railway.app` | Update when web service moves to a custom domain            |
| `NODE_ENV`          | `production`                                  |                                                             |
| `TRUSTED_PROXY`     | `true`                                        | Required behind Railway's proxy for rate limiting           |
| `LOG_LEVEL`         | `info`                                        |                                                             |
| `GOOGLE_CLIENT_ID`  | **`PLACEHOLDER_REPLACE_ME`**                  | Replace with the web client ID from Google Cloud Console    |
| `GOOGLE_CLIENT_IDS` | **`PLACEHOLDER_REPLACE_ME`**                  | Comma-separated: Android, iOS, web client IDs (mobile auth) |

The API doesn't fail to start without `GOOGLE_CLIENT_ID` — auth requests will return `500 CONFIGURATION_ERROR` until they're set.

### `web`

| Variable                  | Value                                        | Notes                                   |
| ------------------------- | -------------------------------------------- | --------------------------------------- |
| `VITE_API_URL`            | `https://api-production-434e.up.railway.app` | Baked into the SPA bundle at build time |
| `RAILPACK_SPA_OUTPUT_DIR` | `apps/frontend/web/dist`                     | Activates Railpack's SPA static server  |

## First-time setup (already done)

The provisioning was performed via the Railway CLI:

```bash
railway init --name gravity-room
railway add --database postgres
railway add --database redis
railway add --service api    # empty service
railway add --service web    # empty service
railway domain --service api  # generates *.up.railway.app
railway domain --service web

# Variables set per service via `railway variable set --service <name> KEY=value`.
# Build/start commands set via `railway environment edit --json` with a config patch.

railway up --service api --detach
railway up --service web --detach
```

## Routine operations

```bash
# Deploy (uploads current working tree)
railway up --service api --detach -m "<summary>"
railway up --service web --detach -m "<summary>"

# Status / logs
railway service list --json
railway logs --service api --lines 200
railway logs --service api --build --lines 200

# Variables
railway variable list --service api --json
railway variable set --service api KEY=value

# Rebuild without code change (e.g. after vars change)
railway redeploy --service api --yes

# Restart only (no rebuild)
railway restart --service api --yes
```

## Custom domain swap

When swapping `*.up.railway.app` for a custom domain:

```bash
railway domain example.com --service web --json   # returns DNS records to configure
railway domain api.example.com --service api --json
```

Then update the cross-wired vars:

```bash
railway variable set --service api CORS_ORIGIN=https://example.com
railway variable set --service web VITE_API_URL=https://api.example.com
railway redeploy --service web --yes   # rebuild SPA bundle with new VITE_API_URL
```

## Troubleshooting

- **API healthcheck fails on first deploy of a fresh Postgres**: increase `deploy.healthcheckTimeout`, or check that `bootstrap.ts`'s migration hotfix is gated behind `if (schemaExists)` so it doesn't run on a fresh DB.
- **API crashloops with `relation X does not exist`**: a prior failed deploy left a partial schema. Wipe with `DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;` against `DATABASE_PUBLIC_URL` (Railway exposes this via the Postgres TCP proxy).
- **Web bundle calls localhost API**: `VITE_API_URL` wasn't available at build time. Ensure the variable is set on the `web` service before `railway up`, then redeploy.
- **CORS errors**: `CORS_ORIGIN` on the `api` service must exactly match the web origin (scheme + host, no trailing slash).
