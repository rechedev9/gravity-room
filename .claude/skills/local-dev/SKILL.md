---
name: local-dev
description: Set up and run the Gravity Room stack locally and E2E-test it as a user — Postgres bootstrap (Windows/Linux), env files, dev login and every auth method, smoke tests, validation commands, and DB ops.
---

# Local development & E2E

> Local dev runs **natively** with Node + pnpm + a local Postgres (Upstash Redis optional).
> There are no Docker images or `docker-compose`; production is serverless on Vercel
> (`api/index.ts`) and the local API is `src/dev-server.ts` (`@hono/node-server`).

### Prerequisites

| Tool          | Version  | Notes                                                                         |
| ------------- | -------- | ----------------------------------------------------------------------------- |
| Node          | ≥ 24     | Runtime for the API (via `tsx`), tooling, and tests                           |
| pnpm          | 11.9.0   | `npm install -g pnpm@11.9.0` (pinned via the `packageManager` field)          |
| PostgreSQL    | ≥ 14     | Local instance or managed (Neon in production)                                |
| Upstash Redis | optional | Set `UPSTASH_REDIS_REST_URL`/`_TOKEN` to enable; in-memory fallback otherwise |

### Environment

Env vars live in `.env` at the workspace root and per-package dirs (loaded into the shell or the process env before running the `tsx`-based scripts; Vite reads `VITE_`-prefixed vars for the web build).

- **API** — `.env` and/or `apps/backend/api/.env`. Minimum:

  ```dotenv
  DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/gravity_room  # REQUIRED — API throws at startup if missing
  JWT_SECRET=change-me-dev-secret-at-least-32-chars-long             # ≥32 chars dev, ≥64 prod
  GOOGLE_CLIENT_ID=...apps.googleusercontent.com                     # optional; POST /api/auth/dev works without it
  GOOGLE_CLIENT_IDS=...web,...mobile                                 # optional
  CORS_ORIGIN=http://localhost:5173                                  # defaults to this Vite origin in dev
  # UPSTASH_REDIS_REST_URL=...                                       # optional → in-memory rate limiting
  # UPSTASH_REDIS_REST_TOKEN=...
  ```

  Migrations + reference-data seeds are NOT applied on boot. Run them once with `pnpm --filter api db:deploy` (idempotent, safe to re-run).

- **Web** — `apps/frontend/web/.env.local`. `VITE_API_URL` is optional in dev (defaults to
  `http://localhost:3001`) but **required** for production builds.

**Local Postgres bootstrap (Ubuntu/Debian):**

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres createdb gravity_room
PGPASSWORD=postgres psql -h localhost -U postgres -d gravity_room -c "SELECT 1"
```

Default dev string: `postgres://postgres:postgres@localhost:5432/gravity_room`.

**Local Postgres bootstrap (Windows):**

The EnterpriseDB installer registers Postgres as a Windows service and does **not** add `psql` to `PATH`.
A machine may have several versions installed side by side, each on its own port (16 → 5432, 17 → 5433 by default).
Pick the instance on `5432` so it matches the default dev string above.

```powershell
# 1. Confirm the service is running and find which port each version uses.
Get-Service postgresql*                                   # e.g. postgresql-x64-16 (Running)
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 5432,5433 | Select LocalPort

# 2. psql is not on PATH - call it by full path (any installed version's client works against any instance).
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$env:PGPASSWORD = "postgres"

# 3. Create the database on the 5432 instance (idempotent: ignore "already exists").
& $psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE gravity_room;"
& $psql -h localhost -p 5432 -U postgres -d gravity_room -c "SELECT 1"
```

If the cluster password is not `postgres`, set it once with
`ALTER USER postgres WITH PASSWORD 'postgres';` and update `DATABASE_URL` accordingly.
Redis is optional in dev - leave `UPSTASH_REDIS_REST_URL`/`_TOKEN` unset and the API falls back to in-memory
rate-limiting and presence (a startup `redis: disabled` in `/health` is expected, not an error).

**Env files used by the local stack (create once, git-ignored):**

- `apps/backend/api/.env`:

  ```dotenv
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gravity_room
  JWT_SECRET=local-dev-secret-change-in-production-min-32-characters-long-enough
  CORS_ORIGIN=http://localhost:5173
  PORT=3001
  # Optional but recommended for full local testing (all hard-disabled in production):
  SWAGGER_ENABLED=true                                    # exposes /swagger and /swagger/json
  AUTH_DEV_ROUTE_ENABLED=true                             # registers POST /api/auth/dev
  AUTH_DEV_ROUTE_SECRET=e2e-dev-secret-not-for-prod       # >= 16 chars; sent as x-dev-auth-secret
  ```

  Use `e2e-dev-secret-not-for-prod` as the secret: it is the canonical value the Playwright e2e suite
  already hard-codes (`playwright.config.ts`) and the web "Dev Login" button defaults to, so the same
  secret unlocks the in-app button, the e2e tests, and manual API calls with zero extra config.

  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` are required-in-prod only; locally the dev sign-in route below
  works without them. The dev route is registered **only** when `AUTH_DEV_ROUTE_ENABLED=true` **and**
  `AUTH_DEV_ROUTE_SECRET` is at least 16 chars (see `routes/auth.ts`).

- `apps/frontend/web/.env.local`:

  ```dotenv
  VITE_API_URL=http://localhost:3001
  # Must match the API's AUTH_DEV_ROUTE_SECRET so the in-app "Dev Login" button works.
  # Defaults to e2e-dev-secret-not-for-prod when omitted, so this line is optional.
  VITE_DEV_AUTH_SECRET=e2e-dev-secret-not-for-prod
  ```

### Run

```bash
pnpm install            # from repo root — installs all workspaces
pnpm --filter api db:deploy   # apply migrations + reference seeds (once; idempotent)
pnpm run dev:api        # API on :3001 (or: pnpm --filter api dev, i.e. tsx watch src/dev-server.ts)
pnpm run dev:web        # web on :5173 (alias: pnpm run dev)
curl http://localhost:3001/health   # → {"status":"ok"}
```

The dev server (`src/dev-server.ts`) serves the same `createApp()` factory the Vercel function mounts,
via `@hono/node-server`. Migrations/seeds are a separate `db:deploy` step (no boot-time DDL). A wrong or
unreachable `DATABASE_URL` surfaces as `connect ECONNREFUSED` on the first DB-touching request. The web
app calls the API at `VITE_API_URL`; keep `CORS_ORIGIN=http://localhost:5173` in the API env so the
browser isn't blocked.

**Smoke-test the running stack (no Google OAuth needed).**
With the dev sign-in flags set above, this mints a real session and exercises the authed routes end to end:

```powershell
$base = "http://localhost:3001"; $secret = "e2e-dev-secret-not-for-prod"
$login = Invoke-RestMethod "$base/api/auth/dev" -Method Post -ContentType application/json `
  -Headers @{ "x-dev-auth-secret" = $secret } -Body (@{ email = "tester@example.com" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod "$base/api/auth/me"   -Headers $h | Select email
(Invoke-RestMethod "$base/api/catalog/" -Headers $h).Count          # 18 seeded programs
(Invoke-RestMethod "$base/api/exercises" -Headers $h).total         # 811 seeded exercises ({ data, total, offset, limit })
```

A healthy boot seeds 18 catalog programs and 811 exercises; `/api/exercises` is paginated
(`{ data, total, offset, limit }`), not a bare array. Open the web UI at <http://localhost:5173>
and Swagger at <http://localhost:3001/swagger>.

### Dev login & E2E as a user

Three interchangeable ways to authenticate against the local stack, all backed by the dev-only
`POST /api/auth/dev` route (registered only when `AUTH_DEV_ROUTE_ENABLED=true` and the
`AUTH_DEV_ROUTE_SECRET` is set; it 404s in production). They share the canonical secret
`e2e-dev-secret-not-for-prod`, so once the env above is in place no extra wiring is needed.

1. **In-app "Dev Login" button (drive the UI as a real user).** Go to <http://localhost:5173/login>
   and click **⚗ Dev Login**. It signs in as `dev@localhost.dev` and lands on `/app` with a full
   session (the httpOnly `refresh_token` cookie is set, so reloads stay logged in). The button is
   rendered only in dev builds (`import.meta.env.DEV`) and is dead-code-eliminated from production.
   It sends the `x-dev-auth-secret` header from `VITE_DEV_AUTH_SECRET` (see `contexts/auth-context.tsx`);
   keep that var equal to the API's `AUTH_DEV_ROUTE_SECRET` or the click fails with a 401 and
   "Algo salió mal".
2. **API token (headless / scripts).** The smoke-test snippet above: `POST /api/auth/dev` with the
   secret header returns `{ user, accessToken }`; pass `Authorization: Bearer <accessToken>` to the
   authed routes. Reuse one email to get the same user across calls (dev logins mint a fresh
   `googleId` each time but de-dupe on email).
3. **Playwright e2e suite.** `apps/frontend/web/e2e/helpers/api.ts` wraps the same route:
   `createAndAuthUser(page)` mints a unique user and shares the refresh cookie with the browser
   context; `createVerifiedPasswordUser` (via `/api/auth/dev/password-user`) seeds a verified
   email/password user so tests can exercise the real login form; `createTestProgram` +
   `seedResultsViaAPI` (with `buildSuccessResults`) seed program + workout data. Run with `pnpm run e2e`
   (Playwright boots its own API + web via `webServer`, hard-coding the same secret).

### All login methods locally

The login page (`/login`) renders providers from `GET /api/auth/providers`, which reports each as
available based on server config. Status of every described method against the local stack:

| Method                      | Enable locally                                    | Local E2E status                                                         |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Email / password            | on by default                                     | ✅ full flow (signup → verify → login → forgot → reset)                  |
| Dev Login (⚗)               | `AUTH_DEV_ROUTE_*` + `VITE_DEV_AUTH_SECRET`       | ✅ one click → `/app`                                                    |
| Guest ("Probar sin cuenta") | always                                            | ✅ enters `/app` in guest mode                                           |
| GitHub                      | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`       | ⚠️ start redirect → real GitHub sign-in; callback needs a real OAuth app |
| Apple                       | `APPLE_CLIENT_ID`                                 | ⚠️ start redirect verified; round-trip needs real Service ID + key       |
| Microsoft (Outlook)         | `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` | ⚠️ start redirect verified; round-trip needs a real app                  |
| Google                      | `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`      | ⛔ left disabled locally (see below)                                     |

**Email / password — fully testable, no Resend needed.** When `RESEND_API_KEY`/`EMAIL_FROM` are unset
(the dev default), the API does not send mail; instead `lib/email.ts` logs the action link at INFO so
the flow is completable locally. Sign up via the UI, then grab the link from the API log:

```powershell
# After submitting the signup form, read the verification link the API logged:
Select-String -Path $apiLog -Pattern 'verify-email\?token=\S+' | Select-Object -Last 1
# Open http://localhost:5173/verify-email?token=... → email is verified and you are auto-logged-in.
# Forgot-password works the same way — grep for 'reset-password?token=' in the log.
```

(`$apiLog` is the file the `pnpm run dev:api` process writes to.) `POST /login` returns **403
`EMAIL_NOT_VERIFIED`** until the address is confirmed, so the verify step is mandatory.

**Social OAuth (GitHub / Apple / Microsoft / Google).** These are gated by real provider credentials —
there is no local mock. To exercise them locally, set the relevant env vars in `apps/backend/api/.env`
(placeholder values are enough to flip `/api/auth/providers` to `true` and make the buttons render
enabled). Each `GET /api/auth/<provider>/start` then 302-redirects to the provider's authorize URL with
the correct `client_id`, `redirect_uri` (`http://localhost:3001/api/auth/<provider>/callback`), `scope`,
`state`, and PKCE — verified for all three redirect-based providers, and GitHub's `/start` lands on the
real GitHub sign-in page. **Completing the round-trip (the `/callback`) requires registering a real app
and using real credentials** (and adding that redirect URI to the provider console). **Google is the
exception:** Google Identity Services validates the client ID against registered origins, so a
placeholder spams the login page console with `client ID is not found` and cannot render cleanly — leave
`GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` unset locally (the button shows `[Pronto]`) until you have a
real web client ID.

### Validate

```bash
pnpm run test           # web + domain + database + api-client + mobile
pnpm run test:api       # API only (needs DATABASE_URL)
pnpm run test:domain    # domain only (no DB)
pnpm run typecheck      # web + domain + database + api-client + mobile
pnpm run typecheck:api  # API
pnpm run lint           # web + API
pnpm run e2e            # Playwright/Chromium — webServer builds web + starts API; set DATABASE_URL first (it does NOT start Postgres)
pnpm run e2e:ui         # interactive UI mode
pnpm run e2e:headed     # visible browser
```

### Database ops (from `apps/backend/api`)

```bash
pnpm run db:generate    # generate migration SQL from schema changes
pnpm run db:deploy      # apply migrations + reference seeds (the build-time deploy step; idempotent)
pnpm run db:migrate     # apply migrations only, manually
pnpm run db:studio      # Drizzle Studio at http://local.drizzle.studio
```

### Gotchas

- **OpenAPI drift**: after changing API routes, regenerate the web client with the API running on
  :3001 — `cd apps/frontend/web && pnpm run api:types`. Drift is gated by CI's `OpenAPI client drift`
  job in `ci.yml`, **not** by Lefthook pre-push (it needs a live API; see Cross-cutting contracts).
- **Service worker**: the PWA SW is disabled in dev (`devOptions.enabled: false` in `vite.config.ts`),
  so stale cache isn't a dev concern. After a prod build, unregister the SW + clear site data in
  DevTools, or hard-reload (Ctrl/Cmd+Shift+R).

### Common errors

| Error                                            | Cause                      | Fix                                                       |
| ------------------------------------------------ | -------------------------- | --------------------------------------------------------- |
| `DATABASE_URL environment variable is required`  | Missing env var            | Add `DATABASE_URL` to `.env`                              |
| `connect ECONNREFUSED 127.0.0.1:5432`            | Postgres not running       | Start Postgres                                            |
| `CORS_ORIGIN contains invalid URL`               | Malformed CORS value       | Use a full URL: `http://localhost:5173`                   |
| `VITE_API_URL must be set for production builds` | Missing var in prod build  | Set `VITE_API_URL` before `pnpm run build`                |
| CI `OpenAPI client drift` job fails              | Generated client stale     | Run `pnpm run api:types` with API running, commit         |
| Playwright `net::ERR_CONNECTION_REFUSED`         | API not started before e2e | Set `DATABASE_URL`; Playwright starts API via `webServer` |

