# Gravity Room

A strength training tracker with a React SPA, a Go API, and a separate analytics service. The repo is deployed with Docker Compose on a VPS behind Caddy.

## Contents

- [Stack](#stack)
- [Monorepo structure](#monorepo-structure)
- [Architecture overview](#architecture-overview)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Docs](#docs)

## Stack

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Runtime    | Go 1.26 (API), Bun (frontend/tooling), Python 3 (analytics)           |
| Frontend   | React 19, Vite, react-router-dom v7, Tailwind CSS 4, TanStack Query 5 |
| Backend    | Go + chi/v5, pgx (PostgreSQL), go-redis (optional), FastAPI analytics |
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
│   │   │   ├── features/     ← Product features and route-owned UI
│   │   │   ├── components/   ← Shared UI primitives and app infrastructure
│   │   │   ├── contexts/     ← Auth, guest, toast, tracker state
│   │   │   ├── hooks/        ← Program, preview, guest and UI hooks
│   │   │   ├── lib/          ← API client and shared frontend utilities
│   │   │   └── styles/       ← Tailwind globals
│   │   └── e2e/              ← Playwright specs
│   ├── go-api/               ← Go API backend (production)
│   │   ├── cmd/api/          ← Entrypoint (main.go)
│   │   ├── internal/
│   │   │   ├── config/       ← Environment-driven configuration
│   │   │   ├── db/           ← Connection pool, probes
│   │   │   ├── handler/      ← HTTP handlers (auth, programs, results, insights, catalog)
│   │   │   ├── middleware/   ← CORS, auth, rate limit, recovery, security headers, request ID
│   │   │   ├── migrate/      ← Goose v3 migrations (33 SQL files, embed.FS)
│   │   │   ├── model/        ← Request/response types
│   │   │   ├── seed/         ← Reference data seeds
│   │   │   ├── server/       ← HTTP server, router, health check
│   │   │   ├── service/      ← Business logic (auth, programs, results)
│   │   │   └── swagger/      ← OpenAPI spec + Swagger UI (dev-only)
│   │   └── go.mod
│   └── analytics/            ← FastAPI analytics worker/service
│       ├── insights/         ← Derived analytics payload builders
│       ├── ml/               ← Forecast / plateau / recommendation logic
│       └── tests/            ← Python tests for analytics logic
├── scripts/
│   ├── committer             ← Safe commit helper (Conventional Commits)
│   ├── docs-list.ts          ← Docs index and read_when hints
│   ├── rollback.sh           ← VPS rollback with migration boundary checks
│   ├── deploy-log.sh         ← Deploy history management
│   └── loadtest.js           ← k6 load test (smoke/load/stress)
├── docs/
│   ├── handoff.md            ← Session handoff notes
│   ├── pickup.md             ← Session rehydration checklist
│   └── roadmapvisuals.md     ← Visual roadmap notes
├── Dockerfile.api            ← Multi-stage build (web SPA + Go binary)
├── docker-compose.yml        ← Production container orchestration
├── Caddyfile.production      ← Reverse proxy config
├── lefthook.yml              ← Git hook definitions
└── tsconfig.base.json        ← Shared TypeScript compiler options
```

## Architecture overview

Three application services behind a Caddy reverse proxy on a VPS. The Go API serves REST endpoints, the web container serves the SPA, and the analytics service pre-computes insights consumed by the API/frontend.

```
Browser (SPA)
  │
  └── HTTPS ──► Caddy (reverse proxy)
                  │
                  ├── /api/*      ───► Go API container (port 3001)
                  ├── /health      ───► Go API health endpoint
                  ├── /metrics     ───► Go API metrics endpoint
                  ├── /swagger/*   ───► Go API Swagger UI (dev only)
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

                  Redis (optional)
                    └── Rate limiting, presence tracking, caching
```

**Key architectural decisions:**

- **Single Go binary** — the API is compiled to a static binary with `CGO_ENABLED=0`. Migrations and seeds are embedded via `embed.FS`. No runtime dependencies.
- **Auto-migrations on startup** — Goose v3 runs pending migrations before accepting traffic. Zero-touch schema updates on deploy.
- **Progression engine** — the Go API runs the authoritative progression engine. The frontend maintains a TypeScript copy (`apps/web/src/lib/shared/`) for offline display and preview.
- **Feature-first frontend** — route-owned screens and domain UI now live under `apps/web/src/features/`, while `components/` is reserved for shared UI and root app scaffolding.

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

# Optional: run analytics service
cd apps/analytics && uvicorn main:app --reload --port 8000
```

The web app runs on `http://localhost:5173`, the API on `http://localhost:3001`, and analytics on `http://localhost:8000`.

## Commands

| Task              | Command                                           |
| ----------------- | ------------------------------------------------- |
| Dev (web)         | `bun run dev:web`                                 |
| Dev (Go API)      | `cd apps/go-api && go run ./cmd/api`              |
| Dev (analytics)   | `cd apps/analytics && uvicorn main:app --reload`  |
| Build (Go API)    | `cd apps/go-api && go build -o bin/api ./cmd/api` |
| Build (web)       | `bun run build:web`                               |
| Type check        | `bun run typecheck`                               |
| Lint (TS)         | `bun run lint`                                    |
| Lint (Go)         | `cd apps/go-api && go vet ./...`                  |
| Test (analytics)  | `cd apps/analytics && pytest`                     |
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

## Docs

The repo currently keeps project context in:

- `docs/pickup.md` for session startup
- `docs/handoff.md` for latest handoff state
- `docs/roadmapvisuals.md` for visual roadmap notes

Use `bun scripts/docs-list.ts` to list docs and their `read_when` hints.
