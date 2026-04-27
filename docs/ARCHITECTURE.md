# Architecture

Gravity Room is a Bun-workspaces monorepo with three runnable services and a
shared TypeScript package. The repo is organized so that the frontend/backend
split is visible from the root tree.

## Top-level layout

```
gravity-room/
├── apps/
│   ├── frontend/            ← user-facing clients
│   │   ├── web/             ← React 19 + Vite SPA (PWA)
│   │   └── mobile/          ← Expo / React Native
│   └── backend/             ← server-side services
│       ├── api/             ← ElysiaJS on Bun (REST + Postgres + Redis)
│       └── analytics/       ← Python / FastAPI microservice (insights, ML)
├── packages/
│   └── domain/              ← @gzclp/domain — Zod schemas + GZCLP engine,
│                              consumed by web, mobile and api as workspace:*
├── docs/                    ← architecture, roadmap, log, llm-map (this folder)
├── scripts/                 ← ops scripts: deploy-log, rollback, loadtest, committer
├── .github/workflows/       ← CI: per-service reusable workflows + auto-format
├── .weave/                  ← Weave agent plans + sessions (gitignored except plans/)
├── docker-compose.yml       ← prod compose (api, web, analytics behind external Caddy)
├── docker-compose.dev.yml   ← dev compose (adds postgres + redis)
├── Caddyfile.production     ← reverse proxy (lives outside, copied for reference)
├── tsconfig.base.json       ← shared TS compiler options
└── package.json             ← workspaces: apps/backend/*, apps/frontend/*, packages/*
```

## Tech stack per service

| Service                  | Tier     | Runtime    | Stack                                                                                               |
| ------------------------ | -------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `apps/frontend/web`      | frontend | Bun + Vite | React 19, TanStack Router, TanStack Query, Tailwind 4, Zod 4, react-hook-form, i18next, Sentry, PWA |
| `apps/frontend/mobile`   | frontend | Bun + Expo | Expo 54, React Native 0.81, expo-sqlite (local), expo-auth-session, TanStack Query                  |
| `apps/backend/api`       | backend  | Bun        | ElysiaJS 1.4, Drizzle ORM + Postgres, ioredis, prom-client, pino, Zod 4, Sentry/Bun                 |
| `apps/backend/analytics` | backend  | Python     | FastAPI 0.115, psycopg 3, scikit-learn, scipy, APScheduler, pydantic 2, ruff                        |
| `packages/domain`        | shared   | Bun        | Pure TS + Zod 4. Exports the GZCLP progression engine and 9 schema modules                          |

## Cross-cutting contracts

- **`@gzclp/domain` (shared)** — single source of truth for the GZCLP engine,
  graduation rules, catalog, and Zod schemas. Imported by web, mobile and api as
  `"@gzclp/domain": "workspace:*"`.
- **OpenAPI → Zod codegen** — the API exposes `/swagger/json`. The web app
  regenerates `apps/frontend/web/src/lib/api/generated.ts` via
  `bun run --filter web api:types` (`apps/frontend/web/codegen/generate-api-types.ts`).
  Lefthook's `pre-push.api-types-drift` ensures the committed file stays in sync.
  Mobile does **not** consume this generated client; it implements API calls by
  hand. Unifying this is on the roadmap (`packages/api-client`).
- **Auth** — JWT access + refresh rotation. Google OAuth via
  `@react-oauth/google` (web), `expo-auth-session` (mobile), and
  `apps/backend/api/src/lib/google-auth.ts` (server).

## Production topology

```
            ┌──────────────────────────┐
            │    Caddy (external)      │
            │  Caddyfile.production    │
            └───────────┬──────────────┘
                        │ host: gravityroom.app
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   /api/*           /health         everything
   /swagger/*      /metrics         else
        │               │               │
        ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐    ┌──────────┐
  │   api    │   │   api    │    │   web    │
  │ Elysia   │   │ Elysia   │    │  nginx   │
  │ :3001    │   │ :3001    │    │  :80     │
  └────┬─────┘   └──────────┘    └──────────┘
       │
       ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Postgres │  │  Redis   │  │analytics │
  │ external │  │ external │  │ FastAPI  │
  └──────────┘  └──────────┘  └──────────┘
```

- The web container (nginx) serves the SPA. The API never serves static assets;
  `apps/backend/api/src/create-app.ts` is HTTP-API only.
- Postgres and Redis are external dependencies (not in `docker-compose.yml`).
  The dev compose (`docker-compose.dev.yml`) adds them locally on a `dev` bridge
  network.
- The analytics service runs on the `backend` network alongside the API and is
  consumed internally — it is not exposed publicly through Caddy.

## Local development

```bash
bun install
bun run dev           # web on :5173 (vite dev)
bun run dev:api       # api on :3001 (bun --watch)
# or, full stack with infra
docker compose -f docker-compose.dev.yml up --build
```

## Validation per service

| Command                                | What it covers                                |
| -------------------------------------- | --------------------------------------------- |
| `bun run typecheck`                    | web + domain + mobile (TS-strict)             |
| `bun run typecheck:api`                | apps/backend/api                              |
| `bun run lint`                         | web (eslint v9 + typescript-eslint)           |
| `bun run format:check`                 | repo-wide prettier 3                          |
| `bun run test`                         | web + domain + mobile bun:test                |
| `bun run test:api`                     | apps/backend/api bun:test (services + routes) |
| `bun run --filter web e2e`             | playwright (chromium)                         |
| `pytest` (in `apps/backend/analytics`) | analytics unit tests                          |

## Why this structure

1. **Frontend vs backend visible from `apps/`** — the previous flat layout
   (`apps/{api,web,mobile,analytics}`) hid the role of each service behind the
   name. New contributors and LLM agents can now classify a path by reading the
   first two segments.
2. **Shared engine in one place** — `packages/domain` is the only cross-tier
   dependency. Web, mobile and api compile against the same Zod schemas and the
   same GZCLP rules, eliminating drift.
3. **Single SPA serving path** — earlier the SPA was baked into the API image
   _and_ served by a separate nginx container. Caddy only ever routed to nginx,
   so the API copy was dead weight. Now the API is HTTP-only and the Dockerfile
   lives next to its source (`apps/backend/api/Dockerfile`).
4. **Disambiguated tooling** — `apps/frontend/web/codegen/` (was `scripts/`) no
   longer collides with the repo-root `scripts/` (ops scripts). `docs/`
   centralizes living-state documents (roadmap, log) that the README points at.

For navigation by paths, see [`docs/llm-map.md`](./llm-map.md).
