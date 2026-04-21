# Gravity Room

A strength training tracker with a React SPA, an ElysiaJS API, and a separate analytics service. The repo is deployed with Docker Compose on a VPS behind Caddy.

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
| Runtime    | Bun (API + frontend/tooling), Python 3 (analytics)                |
| Frontend   | React 19, Vite, TanStack Router, Tailwind CSS 4, TanStack Query 5 |
| Backend    | ElysiaJS, Drizzle ORM (PostgreSQL), Redis, FastAPI analytics      |
| Validation | Zod v4 (frontend schemas), ElysiaJS type validation (API)         |
| Auth       | JWT (access + refresh token rotation), Google OAuth               |
| Logging    | pino (structured JSON)                                            |
| Metrics    | prom-client (Prometheus-compatible)                               |
| E2E        | Playwright (Chromium)                                             |
| Hooks      | Lefthook (parallel pre-commit / pre-push)                         |
| Deploy     | Docker Compose on VPS, Caddy reverse proxy                        |

## Monorepo structure

```
gravity-room/
├── apps/
│   ├── web/                  ← Vite + React 19 SPA (PWA-installable)
│   │   ├── src/
│   │   │   ├── features/     ← Product features and route-owned UI
│   │   │   ├── components/   ← Shared UI primitives and app infrastructure
│   │   │   ├── contexts/     ← Auth, guest, toast, tracker state
│   │   │   ├── hooks/        ← Program, preview, guest and UI hooks
│   │   │   ├── lib/          ← API client and shared frontend utilities
│   │   │   └── styles/       ← Tailwind globals
│   │   └── e2e/              ← Playwright specs
│   ├── api/                  ← ElysiaJS API backend
│   │   └── src/
│   │       ├── routes/       ← HTTP route handlers
│   │       ├── services/     ← Business logic
│   │       ├── middleware/   ← Auth, rate limiting, logging, error handling
│   │       ├── db/           ← Drizzle schema, seeds, migrations
│   │       ├── lib/          ← Redis, metrics, sentry, telegram, logger
│   │       └── plugins/      ← Swagger, metrics plugins
│   └── analytics/            ← FastAPI analytics worker/service
│       ├── insights/         ← Derived analytics payload builders
│       ├── ml/               ← Forecast / plateau / recommendation logic
│       └── tests/            ← Python tests for analytics logic
├── packages/
│   └── domain/               ← Shared domain package for engine, schemas and types
│       └── src/              ← Imported by web and api via @gzclp/domain/*
├── scripts/
│   ├── committer             ← Safe commit helper (Conventional Commits)
│   ├── docs-list.ts          ← Docs index and read_when hints
│   ├── rollback.sh           ← VPS rollback with migration boundary checks
│   ├── deploy-log.sh         ← Deploy history management
│   └── loadtest.js           ← k6 load test (smoke/load/stress)
├── Dockerfile.api            ← Multi-stage build (web SPA + Bun API)
├── docker-compose.yml        ← Production container orchestration
├── Caddyfile.production      ← Reverse proxy config
├── lefthook.yml              ← Git hook definitions
└── tsconfig.base.json        ← Shared TypeScript compiler options
```

## Architecture overview

Three application services behind a Caddy reverse proxy on a VPS. The ElysiaJS API serves REST endpoints, the web container serves the SPA, and the analytics service pre-computes insights consumed by the API/frontend.

```
Browser (SPA)
  │
  └── HTTPS ──► Caddy (reverse proxy)
                  │
                  ├── /api/*      ───► ElysiaJS API container (port 3001)
                  ├── /health      ───► API health endpoint
                  ├── /metrics     ───► API metrics endpoint
                  ├── /swagger/*   ───► API Swagger UI (dev only)
                  └── /*           ───► Web container (Nginx, port 80)

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

- **Bun runtime** — the API runs on Bun with ElysiaJS. Drizzle ORM handles database access and migrations. Seeds are run on startup via `bootstrap.ts`.
- **Auto-migrations on startup** — Drizzle migrator runs pending migrations before accepting traffic. Zero-touch schema updates on deploy.
- **Progression engine** — the API and frontend share the authoritative progression engine via `packages/domain/`, imported through the workspace package `@gzclp/domain/*`.
- **Feature-first frontend** — route-owned screens and domain UI now live under `apps/web/src/features/`, while `components/` is reserved for shared UI and root app scaffolding.

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (latest) — for API, frontend tooling, and tests
- PostgreSQL (local or managed)
- Redis (optional — only needed for distributed rate limiting and presence)

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
cd apps/analytics && uvicorn main:app --reload --port 8000
```

The web app runs on `http://localhost:5173`, the API on `http://localhost:3001`, and analytics on `http://localhost:8000`.

For the Expo mobile app, set `EXPO_PUBLIC_API_URL` to the API origin and configure the Google OAuth client IDs needed by `apps/mobile`:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

The API also requires `GOOGLE_CLIENT_IDS` to include the same mobile/web client IDs accepted by `/api/auth/mobile/google`.

If you already front the API with a path prefix such as `/mobile-api`, set that full prefixed base in `EXPO_PUBLIC_API_URL`. Otherwise the mobile client defaults to `http://localhost:3001/api/*`.

## Commands

| Task                               | Command                                           |
| ---------------------------------- | ------------------------------------------------- |
| Dev (web)                          | `bun run dev:web`                                 |
| Dev (API)                          | `bun run dev:api`                                 |
| Dev (analytics)                    | `cd apps/analytics && uvicorn main:app --reload`  |
| Build (web)                        | `bun run build:web`                               |
| Type check (web + domain + mobile) | `bun run typecheck`                               |
| Type check (API)                   | `bun run typecheck:api`                           |
| Type check (domain)                | `bun run typecheck:domain`                        |
| Lint (TS)                          | `bun run lint`                                    |
| Test (analytics)                   | `cd apps/analytics && pytest`                     |
| Format check                       | `bun run format:check`                            |
| Tests (workspace TS unit)          | `bun run test`                                    |
| Tests (API unit)                   | `bun run test:api`                                |
| E2E tests                          | `bun run e2e`                                     |
| E2E (headed)                       | `bun run e2e:headed`                              |
| Load test                          | `k6 run scripts/loadtest.js`                      |
| Load test (smoke)                  | `k6 run scripts/loadtest.js --env SCENARIO=smoke` |
| Docker build                       | `docker compose build`                            |
| Docker up                          | `docker compose up -d`                            |
| Deploy history                     | `scripts/deploy-log.sh list`                      |
| Rollback                           | `scripts/rollback.sh [--force] <sha>`             |

## Docs

The repo currently keeps project context in:

- `docs/pickup.md` for session startup
- `docs/handoff.md` for latest handoff state
- `docs/roadmapvisuals.md` for visual roadmap notes

Use `bun scripts/docs-list.ts` to list docs and their `read_when` hints.
