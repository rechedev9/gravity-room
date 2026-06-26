# Architecture

Gravity Room is a pnpm-workspaces monorepo with three runnable clients/services
(web, mobile, API) and shared TypeScript packages. It deploys as ONE same-origin
Vercel project: the Vite/React PWA ships as static output and the ElysiaJS API
runs as a Node serverless function. The repo is organized so that the
frontend/backend split is visible from the root tree.

## Top-level layout

```
gravity-room/
├── api/                     ← Vercel catch-all function: api/[...path].ts → app.fetch
├── apps/
│   ├── frontend/            ← user-facing clients
│   │   ├── web/             ← React 19 + Vite SPA (PWA)
│   │   └── mobile/          ← Expo / React Native
│   └── backend/             ← server-side services
│       └── api/             ← ElysiaJS, serverless via app.fetch (REST + Neon
│                              Postgres + Upstash Redis; analytics insight
│                              pipelines under src/analytics)
├── packages/
│   ├── domain/              ← @gzclp/domain — Zod schemas + GZCLP engine
│   ├── database/            ← @gzclp/database — Drizzle schema, seeds, migrations
│   └── api-client/          ← @gzclp/api-client — typed fetch wrapper
├── scripts/                 ← ops/build scripts: vercel-build, loadtest, committer
├── docs/                    ← architecture, llm-map, cutover runbook, memoria
├── .github/workflows/       ← CI + security + Claude bot integrations
├── vercel.json              ← framework, build, function, rewrites, cron config
├── tsconfig.base.json       ← shared TS compiler options
└── package.json             ← workspaces: apps/backend/*, apps/frontend/*, packages/*
```

## Tech stack per service

| Service                | Tier     | Runtime       | Stack                                                                                                               |
| ---------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/web`    | frontend | Node + Vite   | React 19, TanStack Router, TanStack Query, Tailwind 4, Zod 4, react-hook-form, i18next, Sentry, PWA                 |
| `apps/frontend/mobile` | frontend | Node + Expo   | Expo 54, React Native 0.81, expo-sqlite (local), expo-auth-session, TanStack Query                                  |
| `apps/backend/api`     | backend  | Node (Vercel) | ElysiaJS 1.4 (serverless `app.fetch`), Drizzle ORM + Neon Postgres, Upstash Redis (REST), pino, Zod 4, @sentry/node |
| `packages/domain`      | shared   | Node          | Pure TS + Zod 4. Exports the GZCLP progression engine and 9 schema modules                                          |
| `packages/database`    | database | Node          | Drizzle schema, SQL migrations, reference seeds, schema dump tooling                                                |
| `packages/api-client`  | shared   | Node          | Typed fetch wrapper (merge-headers, api-error, single-flight, url helpers)                                          |

Analytics is not a separate service: the insight pipelines (e1RM, frequency,
summary, volume, forecast, plateau, recommendation) were ported to TypeScript and
live inside the API at `apps/backend/api/src/analytics/`, with a small shared
stats helper, an ISO-week helper, and a JS IRLS logistic regression replacing the
former numpy/scipy/scikit-learn stack. Parity with the deleted Python outputs is
frozen by golden-file tests (`src/analytics/pipelines/pipelines.parity.test.ts`).

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
  `pnpm --filter web api:types` (`apps/frontend/web/codegen/generate-api-types.ts`).
  CI's `OpenAPI client drift` job in `.github/workflows/ci.yml` boots the API
  against Postgres, regenerates the client, and fails on generated-client drift.
  Lefthook no longer runs this check locally because it requires a live API.
  Mobile does **not** consume this generated client; it implements API calls by
  hand. Unifying this is on the roadmap (`packages/api-client`).
- **Auth** — JWT access + refresh rotation. Multi-method sign-in (Google, Apple,
  GitHub, Microsoft, and email/password). Google OAuth via `@react-oauth/google`
  (web), `expo-auth-session` (mobile), and
  `apps/backend/api/src/lib/google-auth.ts` (server).

## Service split

- The SPA is served separately from the API. `apps/backend/api/src/create-app.ts`
  is HTTP-API only and never serves static assets.
- Analytics runs in-process inside the API. Insights are pre-computed by the
  TypeScript pipelines under `apps/backend/api/src/analytics/` and persisted to
  the `user_insights` table, then read back via `GET /api/insights`. A Vercel
  Cron job drives a bounded per-user batch through
  `POST /api/internal/analytics/compute` (guarded by `INTERNAL_SECRET`/`CRON_SECRET`).

## Local development

```bash
pnpm install
pnpm --filter api db:deploy   # apply migrations + reference seeds (safe to re-run)
pnpm run dev           # web on :5173 (vite dev)
pnpm run dev:api       # api on :3001 (tsx watch src/dev-server.ts)
```

On Vercel the API has no `app.listen`: the pure `createApp()` factory is mounted
by the catch-all serverless function `api/[...path].ts` and driven via
`app.fetch(request)`. Locally, `src/dev-server.ts` serves that same app on a port
for tooling (e.g. OpenAPI codegen). Migrations and seeds are NOT boot-time DDL;
they run in the build-time deploy step `src/scripts/migrate-deploy.ts` (via
`pnpm --filter api db:deploy`, gated to production in `scripts/vercel-build.sh`)
against the direct Neon endpoint (`DIRECT_DATABASE_URL`).

Postgres must be available locally — point `DATABASE_URL` at your own instance.
Upstash Redis is optional in dev (set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` to enable presence, caches, and rate limiting; without
them those features degrade gracefully). It is mandatory in production.

## Validation per service

| Command                  | What it covers                                                             |
| ------------------------ | -------------------------------------------------------------------------- |
| `pnpm run typecheck`     | web + domain + database + api-client + mobile (TS-strict)                  |
| `pnpm run typecheck:api` | apps/backend/api                                                           |
| `pnpm run lint`          | web + api + api-client (eslint v9 + typescript-eslint)                     |
| `pnpm run format:check`  | repo-wide prettier 3                                                       |
| `pnpm run test`          | web + domain + database + api-client + mobile vitest                       |
| `pnpm run test:api`      | apps/backend/api vitest (services + routes + analytics golden-file parity) |
| `pnpm --filter web e2e`  | playwright (chromium)                                                      |

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
4. **Deploy config is declarative** — `vercel.json` pins the framework, build
   command (`scripts/vercel-build.sh`), serverless function, SPA rewrites, and
   cron schedules in one file at the repo root, so the same-origin topology is
   reviewable in version control.
5. **API is HTTP-only** — the SPA is never served from the API. The API
   (`apps/backend/api/src/create-app.ts`) returns JSON exclusively.
6. **Disambiguated tooling** — `apps/frontend/web/codegen/` (was `scripts/`) no
   longer collides with the repo-root `scripts/` (ops scripts). `docs/`
   centralizes living-state documents (roadmap, log) that the README points at.

For navigation by paths, see [`docs/llm-map.md`](./llm-map.md).
