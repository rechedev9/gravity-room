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
│   ├── domain/              ← @gzclp/domain — Zod schemas + GZCLP engine
│   └── database/            ← @gzclp/database — Drizzle schema, seeds, migrations
├── infra/
│   └── production/          ← Docker Compose + Caddyfile used by VPS deploy
├── docs/                    ← architecture, llm-map, memoria artifacts
├── scripts/                 ← ops scripts: loadtest, committer, context refresh
├── .github/workflows/       ← CI/CD and Claude bot integrations
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
| `packages/database`      | database | Bun        | Drizzle schema, SQL migrations, reference seeds, schema dump tooling                                |

## Cross-cutting contracts

- **`@gzclp/domain` (shared)** — single source of truth for the GZCLP engine,
  graduation rules, catalog, and Zod schemas. Imported by web, mobile and api as
  `"@gzclp/domain": "workspace:*"`.
- **`@gzclp/database` (database)** — single source of truth for Postgres:
  Drizzle schema (`packages/database/src/schema.ts`), migrations
  (`packages/database/migrations/`), and reference seeds
  (`packages/database/src/seeds/`). The API owns runtime connections but imports
  schema/seeds/migrations from this package.
- **OpenAPI → Zod codegen** — the API exposes `/swagger/json`. The web app
  regenerates `apps/frontend/web/src/lib/api/generated.ts` via
  `bun run --filter web api:types` (`apps/frontend/web/codegen/generate-api-types.ts`).
  CI's `validate` workflow boots the API against Postgres, regenerates the
  client, and fails on generated-client drift. Lefthook no longer runs this
  check locally because it requires a live API.
  Mobile does **not** consume this generated client; it implements API calls by
  hand. Unifying this is on the roadmap (`packages/api-client`).
- **Auth** — JWT access + refresh rotation. Google OAuth via
  `@react-oauth/google` (web), `expo-auth-session` (mobile), and
  `apps/backend/api/src/lib/google-auth.ts` (server).

## Service split

- The SPA is served separately from the API. `apps/backend/api/src/create-app.ts`
  is HTTP-API only and never serves static assets.
- The analytics service is consumed internally by the API.

## Local development

```bash
bun install
bun run dev           # web on :5173 (vite dev)
bun run dev:api       # api on :3001 (bun --watch)
```

Postgres and Redis must be available locally — point `DATABASE_URL` and
`REDIS_URL` at your own instances.

## Validation per service

| Command                                | What it covers                                |
| -------------------------------------- | --------------------------------------------- |
| `bun run typecheck`                    | web + domain + database + mobile (TS-strict)  |
| `bun run typecheck:api`                | apps/backend/api                              |
| `bun run lint`                         | web (eslint v9 + typescript-eslint)           |
| `bun run format:check`                 | repo-wide prettier 3                          |
| `bun run test`                         | web + domain + database + mobile bun:test     |
| `bun run test:api`                     | apps/backend/api bun:test (services + routes) |
| `bun run --filter web e2e`             | playwright (chromium)                         |
| `pytest` (in `apps/backend/analytics`) | analytics unit tests                          |

## Why this structure

1. **Frontend vs backend visible from `apps/`** — the previous flat layout
   (`apps/{api,web,mobile,analytics}`) hid the role of each service behind the
   name. New contributors and LLM agents can now classify a path by reading the
   first two segments.
2. **Shared engine in one place** — `packages/domain` owns cross-tier
   training logic. Web, mobile and api compile against the same Zod schemas and
   the same GZCLP rules, eliminating drift.
3. **Database in one place** — `packages/database` owns Postgres structure and
   reference data. The API still owns connections and service-level queries, but
   schema/migrations/seeds no longer hide inside the API app.
4. **Infra is explicit** — production-only deployment files live under
   `infra/production/`, not mixed into the repo root.
5. **API is HTTP-only** — the SPA is never served from the API. The API
   (`apps/backend/api/src/create-app.ts`) returns JSON exclusively.
6. **Disambiguated tooling** — `apps/frontend/web/codegen/` (was `scripts/`) no
   longer collides with the repo-root `scripts/` (ops scripts). `docs/`
   centralizes living-state documents (roadmap, log) that the README points at.

For navigation by paths, see [`docs/llm-map.md`](./llm-map.md).
