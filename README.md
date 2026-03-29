<div align="center">
  <img src="docs/assets/banner.png" alt="Gravity Room Header" width="100%" />
</div>

<br />

# Gravity Room

A strength training tracker for any program. Define your progression rules declaratively — the engine handles the rest. Built as a monorepo with a Vite + React 19 SPA frontend and a Go (chi) API backend, deployed via Docker on a VPS behind Caddy.

For rationale on every framework and tool choice, see [docs/tech-stack.md](docs/tech-stack.md).

## Contents

- [Stack](#stack)
- [Monorepo structure](#monorepo-structure)
- [Architecture overview](#architecture-overview)
- [Program system](#program-system)
- [Auth flow](#auth-flow)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Frontend architecture](#frontend-architecture)
- [Observability](#observability)
- [Security](#security)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Quality gates](#quality-gates)

## Stack

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Runtime    | Go 1.26 (API), Bun (package manager, test runner, frontend tooling)   |
| Frontend   | React 19, Vite, react-router-dom v7, Tailwind CSS 4, TanStack Query 5 |
| Backend    | Go + chi/v5, pgx (PostgreSQL), go-redis (optional)                    |
| Validation | Zod v4 (frontend schemas), Go struct validation (API)                 |
| Auth       | JWT (access + refresh token rotation), Google OAuth                   |
| Logging    | slog (structured JSON)                                                |
| Metrics    | prometheus/client_golang (Prometheus-compatible)                      |
| E2E        | Playwright (Chromium)                                                 |
| Hooks      | Lefthook (parallel pre-commit / pre-push)                             |
| Deploy     | Docker Compose on VPS, Caddy reverse proxy                            |

## Monorepo structure

```
gravity-room/
├── apps/
│   ├── web/                  ← Vite + React 19 SPA (PWA-installable)
│   │   ├── src/
│   │   │   ├── components/   ← React components (workout cards, stats, modals)
│   │   │   ├── contexts/     ← AuthContext, ToastContext
│   │   │   ├── hooks/        ← use-program, use-generic-program
│   │   │   ├── lib/          ← API client, auth, guest storage, migrations
│   │   │   └── styles/       ← Tailwind globals
│   │   └── e2e/              ← Playwright specs
│   ├── go-api/               ← Go API backend (production)
│   │   ├── cmd/api/          ← Entrypoint (main.go)
│   │   ├── internal/
│   │   │   ├── config/       ← Environment-driven configuration
│   │   │   ├── db/           ← Connection pool, probes
│   │   │   ├── handler/      ← HTTP handlers (auth, programs, results, catalog, exercises, definitions)
│   │   │   ├── middleware/    ← CORS, auth, rate limit, recovery, security headers, request ID
│   │   │   ├── migrate/      ← Goose v3 migrations (33 SQL files, embed.FS)
│   │   │   ├── model/        ← Request/response types
│   │   │   ├── seed/         ← Reference data seeds (muscle groups, exercises, programs)
│   │   │   ├── server/       ← HTTP server, router, health check
│   │   │   ├── service/      ← Business logic (auth, programs, results)
│   │   │   └── swagger/      ← OpenAPI spec + Swagger UI (dev-only)
│   │   └── go.mod
├── scripts/
│   ├── committer             ← Safe commit helper (Conventional Commits)
│   ├── rollback.sh           ← VPS rollback with migration boundary checks
│   ├── deploy-log.sh         ← Deploy history management
│   └── loadtest.js           ← k6 load test (smoke/load/stress)
├── docs/
│   └── tech-stack.md         ← Framework justifications
├── Dockerfile.api            ← Multi-stage build (web SPA + Go binary)
├── docker-compose.yml        ← Production container orchestration
├── Caddyfile.production      ← Reverse proxy config
├── lefthook.yml              ← Git hook definitions
└── tsconfig.base.json        ← Shared TypeScript compiler options
```

## Architecture overview

Two Docker containers behind a Caddy reverse proxy on a VPS. The Go API serves both REST endpoints and the pre-built SPA static files.

```
Browser (SPA)
  │
  └── HTTPS ──► Caddy (reverse proxy)
                  │
                  ├── /api/*  ──────► Go API container (port 3001)
                  ├── /health ──────►   ├── chi/v5 router
                  ├── /metrics ─────►   ├── pgx connection pool → PostgreSQL
                  ├── /swagger/* ───►   ├── go-redis → Redis (optional)
                  │                     ├── 33 goose migrations (embed.FS)
                  │                     ├── SPA fallback: /* → index.html
                  │                     └── Graceful shutdown (10s drain)
                  │
                  └── /* ───────────► Web container (Nginx, port 80)
                                        └── Vite SPA bundle (apps/web/dist)
```

```
                  PostgreSQL
                    └── 5 tables: users, refresh_tokens,
                       program_instances, workout_results, undo_entries

                  Redis (optional)
                    └── Rate limiting, presence tracking, caching
```

**Key architectural decisions:**

- **Single Go binary** — the API is compiled to a static binary with `CGO_ENABLED=0`. Migrations and seeds are embedded via `embed.FS`. No runtime dependencies.
- **Auto-migrations on startup** — Goose v3 runs pending migrations before accepting traffic. Zero-touch schema updates on deploy.
- **Progression engine** — the Go API runs the authoritative progression engine. The frontend maintains a TypeScript copy (`apps/web/src/lib/shared/`) for offline display and preview.

## Program system

<div align="center">
  <img src="docs/assets/feature_engine.png" alt="Generic Program Engine" width="100%" />
</div>

The tracker supports multiple strength programs through a **generic program engine**. Each program is defined declaratively — adding a new program requires no engine changes, only a new definition.

### Registered programs

| Program     | Workouts | Days/Week | Description                                                                           |
| ----------- | -------- | --------- | ------------------------------------------------------------------------------------- |
| **GZCLP**   | 90       | 4         | Linear progression with T1/T2/T3 tiers, stage-based failure recovery                  |
| **Nivel 7** | 48       | 4         | 12-week Spanish strength program, wave periodization + double progression accessories |

### How the engine works

`computeGenericProgram(definition, results)` replays all workouts from the start, applying progression rules slot-by-slot:

1. Each workout has **slots** (e.g., `day1-t1`, `day1-t2`, `day1-t3`) defined by the program.
2. Each slot has an exercise, a set/rep scheme per **stage**, and progression rules for success and failure.
3. The engine iterates through every workout in order, checking the result for each slot and applying the corresponding rule.

**Progression rules:**

<div align="center">
  <img src="docs/assets/feature_progression.png" alt="Progression Rules" width="100%" />
</div>

| Rule                       | Effect                                          |
| -------------------------- | ----------------------------------------------- |
| `add_weight`               | Increment weight by the slot's step value       |
| `advance_stage`            | Move to the next stage (fewer reps, more sets)  |
| `advance_stage_add_weight` | Both advance stage and add weight               |
| `deload_percent`           | Reduce weight by a percentage, reset stage to 0 |
| `add_weight_reset_stage`   | Flat weight add + reset stage (T2 deload)       |
| `no_change`                | No progression                                  |

### Data formats

Two result formats coexist:

- **Slot-keyed** (API and generic engine): `{ 'day1-t1': { result: 'success', amrapReps: 8, rpe: 7 } }`
- **Tier-keyed** (GZCLP legacy components): `{ t1: 'success', t2: 'fail', t1Reps: 8, rpe: 7 }`

Translation happens at the API boundary in `api-functions.ts`. Generic programs (Nivel 7) use slot-keyed format end-to-end.

## Auth flow

Authentication uses **JWT dual-token rotation** with Google OAuth sign-in. No third-party auth service.

```
┌─────────┐                              ┌──────────┐                    ┌──────────┐
│ Browser  │                              │   API    │                    │ Google   │
└────┬─────┘                              └────┬─────┘                    └────┬─────┘
     │  1. Google One Tap credential           │                               │
     │ ──────────────────────────────────────►  │  2. Verify ID token (RS256)   │
     │                                         │  ─────────────────────────────►│
     │                                         │  ◄───────────────────────────  │
     │                                         │  3. Find or create user        │
     │  4. Access token (body) +               │                               │
     │     Refresh token (httpOnly cookie)     │                               │
     │ ◄──────────────────────────────────────  │                               │
     │                                         │                               │
     │  5. API calls with Authorization        │                               │
     │     header (Bearer <access_token>)      │                               │
     │ ──────────────────────────────────────►  │                               │
     │                                         │                               │
     │  6. On 401: POST /auth/refresh          │                               │
     │     (httpOnly cookie sent automatically) │                               │
     │ ──────────────────────────────────────►  │                               │
     │                                         │  7. Rotate refresh token       │
     │  8. New access + refresh tokens         │     (old revoked, new issued)  │
     │ ◄──────────────────────────────────────  │                               │
```

**Token storage:**

| Token         | Storage                | Lifetime | Purpose            |
| ------------- | ---------------------- | -------- | ------------------ |
| Access token  | In-memory JS variable  | 15 min   | API authorization  |
| Refresh token | httpOnly Secure cookie | 7 days   | Session continuity |

**Token theft detection:** Each refresh token stores the hash of its predecessor (`previousTokenHash`). If a rotated-out token is re-presented, the API detects the reuse and **revokes all sessions** for that user.

**Refresh mutex:** The frontend's `api.ts` implements a promise-based mutex. When multiple concurrent requests get a 401, they all await the same refresh promise — preventing parallel refresh races.

### Guest mode

Users can use the app without signing in. Guest data is stored in `localStorage` (Zod-validated on every read). On sign-in, guest program instances are imported to the authenticated account via `POST /programs/import`, and localStorage is cleared.

## Database schema

Five PostgreSQL tables with UUID primary keys and `ON DELETE CASCADE` foreign keys:

```
┌──────────────┐       ┌──────────────────┐
│    users     │       │  refresh_tokens   │
│──────────────│       │──────────────────│
│ id        PK │◄──┐   │ id            PK │
│ email        │   ├───│ user_id       FK │
│ google_id    │   │   │ token_hash       │
│ name         │   │   │ previous_token_  │
│ created_at   │   │   │   hash           │
│ updated_at   │   │   │ expires_at       │
└──────────────┘   │   └──────────────────┘
                   │
                   │   ┌──────────────────┐       ┌──────────────────┐
                   │   │program_instances │       │ workout_results  │
                   │   │──────────────────│       │──────────────────│
                   ├───│ user_id       FK │   ┌───│ instance_id  FK  │
                   │   │ id            PK │◄──┤   │ id            PK │
                   │   │ program_id       │   │   │ workout_index    │
                   │   │ name             │   │   │ slot_id          │
                   │   │ config     JSONB │   │   │ result           │
                   │   │ status      ENUM │   │   │ amrap_reps       │
                   │   └──────────────────┘   │   │ rpe              │
                   │                          │   └──────────────────┘
                   │                          │
                   │                          │   ┌──────────────────┐
                   │                          │   │  undo_entries    │
                   │                          │   │──────────────────│
                   │                          └───│ instance_id  FK  │
                   │                              │ id (serial)   PK │
                   │                              │ workout_index    │
                   │                              │ slot_id          │
                   │                              │ prev_result      │
                   │                              │ prev_amrap_reps  │
                   │                              │ prev_rpe         │
                   │                              └──────────────────┘
```

**Key design decisions:**

- **Normalized results** — one row per slot per workout, not a JSONB blob. Enables efficient queries and clean undo history.
- **Transactional undo** — every `POST /results` upserts the result and pushes an undo entry (recording the previous state) in the same transaction. `POST /undo` pops the newest entry by serial PK and restores it.
- **Undo stack cap** — limited to 50 entries per instance. Oldest entries are trimmed within the mutation transaction.
- **JSONB config** — `program_instances.config` stores starting weights and program-specific configuration as a flexible JSON blob. No schema migration needed when program definitions change.

## API reference

All endpoints except `/catalog/*` and `/health` require authentication via `Authorization: Bearer <access_token>`.

### Auth (`/auth`)

| Method | Path            | Auth   | Rate limit    | Description                                |
| ------ | --------------- | ------ | ------------- | ------------------------------------------ |
| POST   | `/auth/google`  | None   | 10/min per IP | Sign in with Google ID token               |
| POST   | `/auth/refresh` | Cookie | 20/min per IP | Rotate refresh token, get new access token |
| POST   | `/auth/signout` | Bearer | 20/min per IP | Revoke refresh token                       |
| GET    | `/auth/me`      | Bearer | —             | Get current user info                      |
| POST   | `/auth/dev`     | None   | Dev only      | Create test user (404 in production)       |

### Programs (`/programs`)

| Method | Path                   | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/programs`            | List user's programs (cursor-based pagination) |
| POST   | `/programs`            | Create a new program instance                  |
| GET    | `/programs/:id`        | Get program detail with all results            |
| PUT    | `/programs/:id`        | Update program (name, config, status)          |
| DELETE | `/programs/:id`        | Delete program instance                        |
| POST   | `/programs/import`     | Import program instances (guest promotion)     |
| GET    | `/programs/:id/export` | Export program data                            |

### Results (`/programs/:id`)

| Method | Path                    | Description                            |
| ------ | ----------------------- | -------------------------------------- |
| POST   | `/programs/:id/results` | Record a workout result (+ undo entry) |
| DELETE | `/programs/:id/results` | Delete a specific result               |
| POST   | `/programs/:id/undo`    | Undo last action (pop undo stack)      |

### Catalog (`/catalog`) — public, no auth required

| Method | Path           | Description                            |
| ------ | -------------- | -------------------------------------- |
| GET    | `/catalog`     | List all available program definitions |
| GET    | `/catalog/:id` | Get a specific program definition      |

### System

| Method | Path       | Auth        | Description                              |
| ------ | ---------- | ----------- | ---------------------------------------- |
| GET    | `/health`  | None        | Liveness probe (DB + Redis connectivity) |
| GET    | `/metrics` | Bearer opt. | Prometheus metrics endpoint              |
| GET    | `/swagger` | None        | Swagger UI (dev only)                    |

## Frontend architecture

### Provider tree (outermost to innermost)

```
StrictMode
  └── Providers
        └── ErrorBoundary (root — reload fallback)
              └── GoogleOAuthProvider
                    └── QueryClientProvider (TanStack Query)
                          └── RouterProvider
                                └── RootLayout
                                      └── AuthProvider
                                            └── ToastProvider
                                                  └── <Outlet /> (routes)
```

### Routes

| Route      | Component     | Loading | Description                                        |
| ---------- | ------------- | ------- | -------------------------------------------------- |
| `/`        | —             | —       | Redirect to `/app`                                 |
| `/app`     | `AppShell`    | Eager   | Main tracker (dashboard / tracker / profile views) |
| `/login`   | `LoginPage`   | Lazy    | Google sign-in / sign-up                           |
| `/privacy` | `PrivacyPage` | Lazy    | Privacy policy                                     |
| `*`        | `NotFound`    | Lazy    | 404 page                                           |

### View state machine

`AppShell` manages three views — **dashboard**, **tracker**, and **profile** — with direction-aware slide animations. The current view is synced to the URL search param (`?view=tracker`), making views deep-linkable.

### Optimistic updates

All result mutations use TanStack Query's optimistic update pattern:

1. `onMutate` — cancel in-flight queries, snapshot previous data, apply optimistic update to cache
2. `onError` — roll back cache to the snapshot
3. `onSettled` — invalidate queries to sync with server truth

A shared `optimisticDetailCallbacks()` helper generates the three lifecycle callbacks for every mutation (mark result, set AMRAP reps, set RPE, undo).

### Error boundaries

Two-tier strategy:

- **Root boundary** (`providers.tsx`) — catches unrecoverable errors, shows a reload fallback
- **Stats boundary** (`gzclp-app.tsx`) — isolates chart/stats failures, shows a reset fallback without crashing the tracker

### PWA

The app is installable as a Progressive Web App. A service worker is registered in `main.tsx`, and the web manifest (`manifest.webmanifest`) provides the app name, icons, and theme color.

## Observability

### Structured logging (slog)

All API logs are structured JSON via Go's `log/slog`:

- Each request gets a child logger with `reqId`, `method`, `url`, and `ip`
- The `x-request-id` header is propagated (or generated as a UUID)
- `authorization` and `cookie` headers are **redacted** in all log output

### Prometheus metrics (`GET /metrics`)

| Metric                          | Type      | Labels                     |
| ------------------------------- | --------- | -------------------------- |
| `http_request_duration_seconds` | Histogram | method, route, status_code |
| `http_requests_total`           | Counter   | method, route, status_code |
| `http_errors_total`             | Counter   | status_class, error_code   |
| `rate_limit_hits_total`         | Counter   | endpoint                   |

Route labels normalize dynamic segments (`/programs/abc-123` → `/programs/:id`) to prevent high-cardinality label explosion.

### Error tracking (Sentry)

Panics and 5xx errors are captured to Sentry via `sentry-go`. Set `SENTRY_DSN` to enable.

## Security

| Concern               | Implementation                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Token storage         | Access token in memory (not localStorage). Refresh token as httpOnly Secure SameSite=Strict cookie.       |
| Token theft detection | Refresh token chain via `previousTokenHash`. Reuse triggers full session revocation.                      |
| Refresh token storage | SHA-256 hashed in the database, never stored in plaintext.                                                |
| Rate limiting         | Sliding window per endpoint per IP. Dual backend: in-memory (default) or Redis (when `REDIS_URL` is set). |
| Security headers      | CSP, X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, HSTS (production).                  |
| Input validation      | Manual validation in Go handlers. Zod schemas on the frontend.                                            |
| SQL injection         | pgx with parameterized queries. No string interpolation in SQL.                                           |
| CORS                  | Explicit origin allowlist via `CORS_ORIGIN`. Required in production.                                      |

## Getting started

### Prerequisites

- [Go](https://go.dev/) 1.26+
- [Bun](https://bun.sh/) (latest) — for frontend tooling and contract tests
- PostgreSQL (local or managed)
- Redis (optional — only needed for distributed rate limiting and presence)

### Setup

```bash
# Install frontend dependencies
bun install

# Configure environment (copy .env.example and set DATABASE_URL, JWT_SECRET, etc.)

# Start the Go API (auto-runs migrations and seeds on startup)
cd apps/go-api && go run ./cmd/api

# In another terminal, start the web dev server
bun run dev:web
```

The web app runs on `http://localhost:5173` and the API on `http://localhost:3001`.
Swagger UI is available at `http://localhost:3001/swagger` (dev only).

## Commands

| Task              | Command                                           |
| ----------------- | ------------------------------------------------- |
| Dev (web)         | `bun run dev:web`                                 |
| Dev (Go API)      | `cd apps/go-api && go run ./cmd/api`              |
| Build (Go API)    | `cd apps/go-api && go build -o bin/api ./cmd/api` |
| Build (web)       | `bun run build:web`                               |
| Type check        | `bun run typecheck`                               |
| Lint (TS)         | `bun run lint`                                    |
| Lint (Go)         | `cd apps/go-api && go vet ./...`                  |
| Format check      | `bun run format:check`                            |
| Tests (TS unit)   | `bun run test`                                    |
| Tests (Go unit)   | `cd apps/go-api && go test ./...`                 |
| E2E tests         | `bun run e2e`                                     |
| E2E (headed)      | `bun run e2e:headed`                              |
| Load test         | `k6 run scripts/loadtest.js`                      |
| Load test (smoke) | `k6 run scripts/loadtest.js --env SCENARIO=smoke` |
| Docker build      | `docker compose build`                            |
| Docker up         | `docker compose up -d`                            |
| Deploy history    | `scripts/deploy-log.sh list`                      |
| Rollback          | `scripts/rollback.sh [--force] <sha>`             |

## Environment variables

### Web (`apps/web/`)

| Variable                | Required   | Description                                                                           |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `VITE_API_URL`          | Production | API URL, baked into bundle at build time. Defaults to `http://localhost:3001` in dev. |
| `VITE_GOOGLE_CLIENT_ID` | Always     | Google OAuth client ID for sign-in                                                    |

### API (`apps/go-api/`)

| Variable             | Required   | Description                                            |
| -------------------- | ---------- | ------------------------------------------------------ |
| `DATABASE_URL`       | Always     | PostgreSQL connection string                           |
| `JWT_SECRET`         | Always     | HS256 signing key (64+ chars in production)            |
| `CORS_ORIGIN`        | Production | Allowed origins (comma-separated)                      |
| `GOOGLE_CLIENT_ID`   | Always     | Google OAuth client ID (server-side validation)        |
| `PORT`               | No         | Server port (default: 3001)                            |
| `NODE_ENV`           | No         | `production` enables SSL, HSTS, stricter CORS          |
| `REDIS_URL`          | No         | Redis URL for rate limiting, presence, caching         |
| `SENTRY_DSN`         | No         | Sentry error tracking DSN                              |
| `METRICS_TOKEN`      | Production | Bearer token to protect `/metrics` endpoint            |
| `TRUSTED_PROXY`      | No         | Set to `true` to trust `X-Forwarded-For`               |
| `LOG_LEVEL`          | No         | slog level (default: `info`)                           |
| `JWT_ACCESS_EXPIRY`  | No         | Access token TTL (default: `15m`)                      |
| `DB_POOL_SIZE`       | No         | PostgreSQL connection pool size (default: 50)          |
| `DB_SSL`             | No         | Force SSL for DB (default: true in prod, false in dev) |
| `ADMIN_USER_IDS`     | No         | Comma-separated UUIDs for admin access                 |
| `TELEGRAM_BOT_TOKEN` | No         | Telegram bot token for new-user notifications          |
| `TELEGRAM_CHAT_ID`   | No         | Telegram chat ID for notifications                     |

## Deployment

### Docker Compose (production)

The project deploys as two Docker containers on a VPS behind Caddy:

```yaml
# docker-compose.yml
services:
  api: # Go binary + embedded web SPA, port 3001
  web: # Nginx serving SPA, port 80
```

**Build:** Multi-stage `Dockerfile.api` — Stage 1 builds the Vite SPA with Bun, Stage 2 compiles the Go binary (`CGO_ENABLED=0`), Stage 3 produces an Alpine image with both.

**Runtime:** The Go binary auto-runs goose migrations and seeds on startup, then listens on port 3001. Caddy routes `/api/*`, `/health`, `/metrics`, and `/swagger/*` to the API; everything else to the web container.

### CI/CD (GitHub Actions)

Three-stage pipeline on every push to `main`:

1. **go-harness** — contract tests against Go API (PostgreSQL service container)
2. **e2e-go** — Playwright E2E tests against Go API
3. **deploy** (after both pass) — SSH into VPS, pull, build, `docker compose up -d`, health checks, Telegram notification

### Rollback

```bash
scripts/rollback.sh                  # roll back to previous deploy
scripts/rollback.sh <sha>            # roll back to specific commit
scripts/rollback.sh --force <sha>    # skip confirmation prompts
scripts/rollback.sh --list           # show deploy history
```

The rollback script checks migration boundaries, rebuilds containers, runs health checks, and records the rollback in `.deploy.log`.

## Quality gates

### Git hooks (Lefthook)

| Hook         | Execution | Commands                            |
| ------------ | --------- | ----------------------------------- |
| `pre-commit` | Parallel  | `typecheck`, `lint`, `format:check` |
| `pre-push`   | Parallel  | `test`, `build`                     |

### TypeScript

`strict: true` across all packages. Production code bans `any`, `as Type` assertions, `@ts-ignore`, `@ts-expect-error`, and non-null assertions (`!`). Test files relax `as Type` and `!`.

### ESLint

Production code enforces: no `any`, no type assertions, no `console.log` (only `console.warn`/`console.error`), max nesting depth of 3.

### Testing

- **Go unit tests:** `go test ./...` in `apps/go-api/`.
- **TS unit/integration:** `bun:test` with `describe`/`it`. Tests live alongside source (`feature.test.ts`).
- **E2E:** Playwright (Chromium only). Tests in `apps/web/e2e/*.spec.ts`. The test server builds the SPA and runs the Go API — testing the production bundle against a real API.
- **Load tests:** `k6 run scripts/loadtest.js` — smoke, load, and stress scenarios against the Go API.
