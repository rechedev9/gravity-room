# The Real Hyperbolic Time Chamber

A strength training tracker for any program. Define your progression rules declaratively — the engine handles the rest. Built as a Bun monorepo with a Vite + React 19 SPA frontend and an ElysiaJS API backend.

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
| Runtime    | Bun (package manager, test runner, script runner, API runtime)        |
| Frontend   | React 19, Vite, react-router-dom v7, Tailwind CSS 4, TanStack Query 5 |
| Backend    | ElysiaJS 1.4, PostgreSQL, Drizzle ORM, Redis (optional)               |
| Shared     | Pure computation package (`@gzclp/shared`) — no DOM deps              |
| Validation | Zod v4 (schemas shared between web and API)                           |
| Auth       | JWT (access + refresh token rotation), Google OAuth                   |
| Logging    | Pino (structured JSON)                                                |
| Metrics    | prom-client (Prometheus-compatible)                                   |
| E2E        | Playwright (Chromium)                                                 |
| Hooks      | Lefthook (parallel pre-commit / pre-push)                             |
| Deploy     | Railway (single service, Nixpacks)                                    |

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
│   └── api/                  ← ElysiaJS backend
│       ├── src/
│       │   ├── db/           ← Drizzle schema, seed, connection
│       │   ├── lib/          ← Logger, Redis, metrics, Google auth
│       │   ├── middleware/   ← Error handler, auth guard, rate limit, request logger
│       │   ├── plugins/      ← Swagger, metrics plugin
│       │   ├── routes/       ← Auth, programs, results, catalog
│       │   └── services/     ← Business logic (auth, programs, results)
│       └── drizzle/          ← SQL migration files
├── packages/
│   └── shared/               ← Pure computation (engine, stats, schemas)
│       └── src/
│           ├── engine.ts             ← computeProgram (GZCLP legacy)
│           ├── generic-engine.ts     ← computeGenericProgram (program-agnostic)
│           ├── schemas/              ← Zod v4 schemas (legacy, instance, program-definition)
│           ├── programs/             ← Program definitions (GZCLP, Nivel 7) + registry
│           └── types/                ← TypeScript types inferred from Zod
├── docs/
│   └── tech-stack.md         ← Framework justifications
├── railway.toml              ← Railway deployment config
├── lefthook.yml              ← Git hook definitions
└── tsconfig.base.json        ← Shared TypeScript compiler options
```

## Architecture overview

The entire application deploys as a **single Railway service**. The ElysiaJS API serves both the API routes and the pre-built SPA static files from the same process.

```
Browser (SPA)
  │
  └── HTTPS ──► Railway (single service, port 3001)
                  │
                  ├── Static files: apps/web/dist/*  (Vite SPA bundle)
                  ├── SPA fallback: /*  →  index.html
                  │
                  ├── /auth/*          Auth routes (Google OAuth, JWT)
                  ├── /programs/*      Program CRUD, import/export
                  ├── /results/*       Workout result recording
                  ├── /catalog/*       Public program catalog
                  ├── /health          Liveness probe (DB + Redis)
                  └── /metrics         Prometheus metrics
                        │
                        ├── PostgreSQL (Drizzle ORM, postgres.js driver)
                        │     └── 5 tables: users, refresh_tokens,
                        │        program_instances, workout_results, undo_entries
                        │
                        └── Redis (optional — rate limiting backend)
```

**Key architectural decisions:**

- **Single-process deployment** — the API serves the SPA via `@elysiajs/static`. No separate static host or CDN. One service, one port, one health check.
- **Auto-migrations on startup** — Drizzle runs pending migrations before accepting traffic. Zero-touch schema updates on deploy.
- **Shared computation package** — the progression engine is pure TypeScript with no DOM dependencies. Both the frontend and API import `@gzclp/shared/*` to compute workout state deterministically.

## Program system

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

### Structured logging (Pino)

All API logs are structured JSON with per-request context:

- Each request gets a child logger with `reqId`, `method`, `url`, and `ip`
- The `x-request-id` header is propagated (or generated as a UUID)
- `authorization` and `cookie` headers are **redacted** in all log output
- Development uses `pino-pretty` for human-readable output

**Named log events:** `auth.google`, `auth.refresh`, `auth.signout`, `auth.token_reuse_detected`, `program.create`, `program.update`, `program.delete`, `program.import`, `result.record`, `result.delete`, `result.undo`

### Prometheus metrics (`GET /metrics`)

| Metric                          | Type      | Labels                        |
| ------------------------------- | --------- | ----------------------------- |
| `http_request_duration_seconds` | Histogram | method, route, status_code    |
| `http_requests_total`           | Counter   | method, route, status_code    |
| `http_errors_total`             | Counter   | status_class, error_code      |
| `rate_limit_hits_total`         | Counter   | endpoint                      |
| Default process metrics         | Various   | (memory, CPU, event loop lag) |

Route labels normalize dynamic segments (`/programs/abc-123` → `/programs/:id`) to prevent high-cardinality label explosion.

## Security

| Concern               | Implementation                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Token storage         | Access token in memory (not localStorage). Refresh token as httpOnly Secure SameSite=Strict cookie.       |
| Token theft detection | Refresh token chain via `previousTokenHash`. Reuse triggers full session revocation.                      |
| Refresh token storage | SHA-256 hashed in the database, never stored in plaintext.                                                |
| Rate limiting         | Sliding window per endpoint per IP. Dual backend: in-memory (default) or Redis (when `REDIS_URL` is set). |
| Security headers      | CSP, X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, HSTS (production).                  |
| Input validation      | Zod schemas at API boundaries. ElysiaJS schema inference for request bodies.                              |
| SQL injection         | Drizzle ORM with parameterized queries by default.                                                        |
| CORS                  | Explicit origin allowlist via `CORS_ORIGIN`. Required in production.                                      |

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (latest)
- PostgreSQL (local or managed)
- Redis (optional — only needed for distributed rate limiting)

### Setup

```bash
# Install dependencies
bun install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your PostgreSQL URL, JWT secrets, etc.

# Run database migrations
bun run db:migrate

# Start development servers
bun run dev
```

The web app runs on `http://localhost:5173` and the API on `http://localhost:3001`.

## Commands

| Task           | Command                                       |
| -------------- | --------------------------------------------- |
| Dev (all)      | `bun run dev`                                 |
| Dev (web only) | `bun run dev:web`                             |
| Dev (API only) | `bun run dev:api`                             |
| Build          | `bun run build`                               |
| Type check     | `bun run typecheck`                           |
| Lint           | `bun run lint`                                |
| Format check   | `bun run format:check`                        |
| Format fix     | `bun run prettier --write <path>`             |
| Tests (all)    | `bun run test`                                |
| Single test    | `bun test packages/shared/src/engine.test.ts` |
| E2E tests      | `bun run e2e`                                 |
| E2E (headed)   | `bun run e2e:headed`                          |
| E2E (UI mode)  | `bun run e2e:ui`                              |
| DB generate    | `bun run db:generate`                         |
| DB migrate     | `bun run db:migrate`                          |
| DB studio      | `bun run db:studio`                           |
| Local CI       | `bun run ci`                                  |

## Environment variables

### Web (`apps/web/`)

| Variable                | Required   | Description                                                                           |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `VITE_API_URL`          | Production | API URL, baked into bundle at build time. Defaults to `http://localhost:3001` in dev. |
| `VITE_GOOGLE_CLIENT_ID` | Always     | Google OAuth client ID for sign-in                                                    |

### API (`apps/api/`)

| Variable             | Required   | Description                                     |
| -------------------- | ---------- | ----------------------------------------------- |
| `DATABASE_URL`       | Always     | PostgreSQL connection string                    |
| `JWT_ACCESS_SECRET`  | Always     | Signing key for access tokens                   |
| `JWT_REFRESH_SECRET` | Always     | Signing key for refresh tokens                  |
| `CORS_ORIGIN`        | Production | Allowed origins (comma-separated)               |
| `GOOGLE_CLIENT_ID`   | Always     | Google OAuth client ID (server-side validation) |
| `PORT`               | No         | Server port (default: 3001)                     |
| `NODE_ENV`           | No         | `production` enables SSL, HSTS, stricter CORS   |
| `REDIS_URL`          | No         | Redis URL for distributed rate limiting         |
| `METRICS_TOKEN`      | Production | Bearer token to protect `/metrics` endpoint     |
| `TRUSTED_PROXY`      | No         | Set to `true` to trust `X-Forwarded-For`        |
| `LOG_LEVEL`          | No         | Pino log level (default: `info`)                |
| `JWT_ACCESS_EXPIRY`  | No         | Access token TTL (default: `15m`)               |
| `JWT_REFRESH_DAYS`   | No         | Refresh token TTL in days (default: `7`)        |

## Deployment

### Railway (production)

The project deploys as a **single Railway service** via Nixpacks:

```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "bun install --frozen-lockfile && bun run build:web"

[deploy]
startCommand = "bun --cwd apps/api src/index.ts"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Build:** Nixpacks installs dependencies and builds the Vite SPA to `apps/web/dist/`.

**Runtime:** Bun runs the API directly (no transpilation). The API serves the built SPA from `../web/dist` via `@elysiajs/static`, and runs database migrations before accepting traffic.

### CI/CD (GitHub Actions)

Two-job pipeline on every push to `main`:

1. **validate** — install, typecheck, lint, format check, test, build
2. **deploy** (on push only, after validate passes) — deploy to Railway via `railway up`

Concurrency group cancels in-progress runs on new pushes.

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

- **Unit/integration:** `bun:test` with `describe`/`it`. Tests live alongside source (`feature.test.ts`).
- **E2E:** Playwright (Chromium only). Tests in `apps/web/e2e/*.spec.ts`. The test server builds the SPA and runs the API — testing the production bundle against a real API.
