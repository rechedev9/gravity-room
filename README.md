# Gravity Room

A strength training tracker with a React SPA, an Expo mobile client, an
ElysiaJS API, and a Python analytics microservice.

## Contents

- [Stack](#stack)
- [Monorepo structure](#monorepo-structure)
- [Architecture overview](#architecture-overview)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Docs](#docs)

## Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Runtime    | Bun (TS apps + tooling), Python 3 (analytics)                     |
| Frontend   | React 19, Vite, TanStack Router, Tailwind CSS 4, TanStack Query 5 |
| Mobile     | Expo 54, React Native 0.81, expo-sqlite, expo-auth-session        |
| Backend    | ElysiaJS, Drizzle ORM (PostgreSQL), Redis, FastAPI analytics      |
| Validation | Zod v4 (shared via `@gzclp/domain`), ElysiaJS type validation     |
| Auth       | JWT (access + refresh token rotation), Google OAuth               |
| Logging    | pino (structured JSON)                                            |
| Metrics    | prom-client (Prometheus-compatible)                               |
| E2E        | Playwright (Chromium)                                             |
| Hooks      | Lefthook (parallel pre-commit / pre-push)                         |

## Monorepo structure

The repo is organized so that frontend and backend tiers are visible from the
`apps/` root:

```
gravity-room/
├── apps/
│   ├── frontend/
│   │   ├── web/                ← Vite + React 19 SPA (PWA-installable)
│   │   │   ├── src/
│   │   │   │   ├── features/   ← Product features and route-owned UI
│   │   │   │   ├── components/ ← Shared UI primitives and app shell
│   │   │   │   ├── contexts/   ← Auth, guest, toast, tracker state
│   │   │   │   ├── hooks/
│   │   │   │   ├── lib/        ← API client, i18n, sentry, utils
│   │   │   │   └── styles/
│   │   │   ├── codegen/        ← OpenAPI -> Zod client generator (api:types)
│   │   │   └── e2e/            ← Playwright specs
│   │   └── mobile/             ← Expo / React Native client
│   │       └── src/
│   │           ├── features/   ← auth, profile, programs, tracker
│   │           └── lib/        ← auth, db (expo-sqlite), sync, tracker
│   └── backend/
│       ├── api/                ← ElysiaJS API
│       │   ├── src/
│       │   │   ├── routes/     ← HTTP route handlers
│       │   │   ├── services/   ← Business logic (1:1 with routes)
│       │   │   ├── middleware/ ← Auth guard, rate limit, error handler, logger
│       │   │   ├── db/         ← Drizzle schema, seeds
│       │   │   ├── lib/        ← Redis, sentry, telegram, caches, google-auth
│       │   │   └── plugins/    ← Swagger, metrics
│       │   └── drizzle/        ← Generated SQL migrations
│       └── analytics/          ← FastAPI analytics service
│           ├── insights/       ← e1RM, frequency, summary, volume
│           ├── ml/             ← forecast, plateau, recommendation
│           └── tests/          ← pytest
├── packages/
│   └── domain/                 ← @gzclp/domain — Zod schemas + GZCLP engine,
│                                  imported by web, mobile and api as workspace:*
├── docs/                       ← architecture, llm-map, roadmap, log
├── scripts/                    ← ops scripts (commit helper, k6 loadtest)
├── lefthook.yml                ← Git hooks
└── tsconfig.base.json          ← Shared TS compiler options
```

A flat path → purpose lookup is in [`docs/llm-map.md`](docs/llm-map.md).
Architectural rationale and topology diagrams in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Architecture overview

Three application services: the ElysiaJS API serves REST endpoints, the Vite
build outputs the SPA as static assets, and the analytics service pre-computes
insights consumed by the API/frontend.

```
Browser (SPA)  ──►  ElysiaJS API (port 3001)
                      ├── /api/*
                      ├── /health
                      ├── /metrics
                      └── /swagger/*   (dev only)

Web SPA (Vite-built static assets, served by any static host)

Analytics service (FastAPI, port 8000)
  ├── scheduled insight computation
  ├── manual /compute trigger
  └── PostgreSQL-backed derived metrics for dashboard analytics
```

```
                  PostgreSQL
                    └── 5 tables: users, refresh_tokens,
                       program_instances, workout_results, undo_entries

                  Redis
                    └── Rate limiting, presence tracking, caching, singleflight
```

**Key architectural decisions:**

- **Bun runtime** — the API runs on Bun with ElysiaJS. Drizzle ORM handles
  database access and migrations. Seeds are run on startup via `bootstrap.ts`.
- **Auto-migrations on startup** — Drizzle migrator runs pending migrations
  before accepting traffic. Zero-touch schema updates on deploy.
- **Progression engine in `packages/domain`** — the API, web and mobile share
  the authoritative engine via `@gzclp/domain` (workspace package).
- **Feature-first frontend** — route-owned screens and domain UI live under
  `apps/frontend/web/src/features/`; `components/` is reserved for shared UI
  primitives and the app shell.
- **API serves only HTTP** — the SPA is served separately; the API
  (`apps/backend/api/src/create-app.ts`) is HTTP-only and never serves static
  assets.

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (latest) — for API, frontend tooling, and tests
- PostgreSQL (local or managed)
- Redis (optional — only needed for distributed rate limiting and presence)
- Python 3.12 + pip (only for the analytics service)

### Setup

```bash
# Install dependencies
bun install

# Configure environment (copy .env.example and set DATABASE_URL, JWT_SECRET, etc.)

# Start the API (auto-runs migrations and seeds on startup)
bun run dev:api

# In another terminal, start the web dev server
bun run dev:web

# Optional: run analytics service
cd apps/backend/analytics && uvicorn main:app --reload --port 8000
```

The web app runs on `http://localhost:5173`, the API on
`http://localhost:3001`, and analytics on `http://localhost:8000`.

For the Expo mobile app, set `EXPO_PUBLIC_API_URL` to the API origin and
configure the Google OAuth client IDs needed by `apps/frontend/mobile`:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

The API also requires `GOOGLE_CLIENT_IDS` to include the same mobile/web
client IDs accepted by `/api/auth/mobile/google`.

If you already front the API with a path prefix such as `/mobile-api`, set
that full prefixed base in `EXPO_PUBLIC_API_URL`. Otherwise the mobile client
defaults to `http://localhost:3001/api/*`.

## Commands

| Task                               | Command                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| Dev (web)                          | `bun run dev:web`                                        |
| Dev (API)                          | `bun run dev:api`                                        |
| Dev (analytics)                    | `cd apps/backend/analytics && uvicorn main:app --reload` |
| Build (web)                        | `bun run build:web`                                      |
| Type check (web + domain + mobile) | `bun run typecheck`                                      |
| Type check (API)                   | `bun run typecheck:api`                                  |
| Type check (domain)                | `bun run typecheck:domain`                               |
| Lint (TS)                          | `bun run lint`                                           |
| Test (analytics)                   | `cd apps/backend/analytics && pytest`                    |
| Format check                       | `bun run format:check`                                   |
| Tests (workspace TS unit)          | `bun run test`                                           |
| Tests (API unit)                   | `bun run test:api`                                       |
| E2E tests                          | `bun run e2e`                                            |
| E2E (headed)                       | `bun run e2e:headed`                                     |
| Load test                          | `k6 run scripts/loadtest.js`                             |
| Load test (smoke)                  | `k6 run scripts/loadtest.js --env SCENARIO=smoke`        |

## Docs

| File                                           | Purpose                                          |
| ---------------------------------------------- | ------------------------------------------------ |
| [`CLAUDE.md`](CLAUDE.md)                       | Auto-loaded agent context (live API + DB schema) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Tier split, stack per service                    |
| [`docs/llm-map.md`](docs/llm-map.md)           | Flat path -> purpose table for fast navigation   |
