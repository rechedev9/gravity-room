# Architecture

pnpm monorepo: web + mobile + API, shared TS packages. Production is **one
same-origin Vercel project** — Vite SPA (static) + ElysiaJS API (serverless
`api/index.ts`). Agent contracts: root `CLAUDE.md` / `AGENTS.md`.

## Layout

```
gravity-room/
├── api/index.ts              ← generated Vercel catch-all (do not hand-edit)
├── apps/frontend/web/        ← React 19 + Vite SPA (PWA)
├── apps/frontend/mobile/     ← Expo 54 / RN
├── apps/backend/api/         ← ElysiaJS (create-app.ts; analytics under src/analytics)
├── packages/domain/          ← @gzclp/domain — Zod + GZCLP engine
├── packages/database/        ← @gzclp/database — schema, migrations, seeds
├── packages/api-client/      ← @gzclp/api-client — typed fetch helpers
├── scripts/                  ← vercel-build, bundle-api, loadtest, security checks
├── docs/                     ← this file + security runbooks
└── vercel.json               ← build, function, rewrites, crons
```

## Path map

| Path                                             | Role                                 | Run / test                         |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------- |
| `apps/frontend/web/`                             | React SPA, PWA                       | `pnpm run dev` / `test` / `e2e`    |
| `apps/frontend/web/src/features/`                | Feature UI                           | `pnpm --filter web test`           |
| `apps/frontend/web/src/components/`              | Shared UI + shell                    | vitest                             |
| `apps/frontend/web/src/lib/api/generated.ts`     | OpenAPI Zod client (committed)       | `pnpm --filter web api:types`      |
| `apps/frontend/web/codegen/`                     | Codegen for generated client         | vitest on codegen                  |
| `apps/frontend/web/e2e/`                         | Playwright                           | `pnpm run e2e`                     |
| `apps/frontend/mobile/`                          | Expo / RN (hand-written API calls)   | `pnpm --filter mobile typecheck`   |
| `apps/backend/api/`                              | REST API                             | `pnpm run dev:api` / `test:api`    |
| `apps/backend/api/src/routes/`                   | HTTP handlers                        | vitest routes                      |
| `apps/backend/api/src/services/`                 | Business logic                       | vitest services                    |
| `apps/backend/api/src/middleware/`               | auth-guard, errors, rate-limit       | unit tests                         |
| `apps/backend/api/src/lib/`                      | redis, logger, sentry, oauth helpers | unit tests                         |
| `apps/backend/api/src/db/`                       | Runtime Postgres pool                | —                                  |
| `apps/backend/api/src/scripts/migrate-deploy.ts` | Advisory-locked migrate+seed         | `pnpm --filter api db:deploy`      |
| `apps/backend/api/src/analytics/`                | Insight pipelines + cron compute     | vitest analytics                   |
| `apps/backend/api/src/vercel-handler.ts`         | Vercel source entry                  | `pnpm run bundle:api:check`        |
| `api/index.ts`                                   | Generated serverless bundle          | `pnpm run bundle:api:check`        |
| `packages/domain/`                               | GZCLP engine + Zod schemas           | `pnpm run test:domain`             |
| `packages/domain/src/generic-engine.ts`          | Progression engine                   | domain tests                       |
| `packages/database/`                             | Schema, migrations, seeds            | `pnpm run test:database`           |
| `packages/database/src/schema.ts`                | Tables / indexes                     | `pnpm run db:generate` after edits |
| `packages/api-client/`                           | Shared fetch helpers                 | `pnpm run test:api-client`         |
| `scripts/bundle-api-function.mjs`                | Build/check `api/index.ts`           | `pnpm run bundle:api:check`        |
| `scripts/vercel-build.sh`                        | Vercel build + prod db:deploy        | Vercel                             |
| `lefthook.yml`                                   | pre-commit / pre-push gates          | lefthook                           |

## Contracts

- **`@gzclp/domain`** — SoT for GZCLP rules + shared Zod. Never reimplement in apps.
- **`@gzclp/database`** — SoT for Postgres schema/migrations/seeds. API owns the pool only.
- **Web OpenAPI client** — regenerate `generated.ts` after route changes (`api:types` with API up). Mobile does not use it.
- **Auth** — JWT access + refresh rotation; multi-method (Google, Apple, GitHub, Microsoft, email/password).
- **API is HTTP-only** — SPA is static on Vercel; `create-app.ts` never serves assets.
- **Analytics in-process** — pipelines in `src/analytics/`, stored in `user_insights`, driven by cron `POST /api/internal/analytics/compute`. Golden parity: `__fixtures__/golden.json`.
- **Migrations build-time** — `db:deploy` at end of `vercel-build.sh` (prod needs `DIRECT_DATABASE_URL`); no boot-time DDL.

## Local dev

```bash
pnpm install
pnpm --filter api db:deploy
pnpm run dev:api    # :3001
pnpm run dev        # :5173
```

Postgres required (`DATABASE_URL`). Upstash Redis optional locally, required in prod.

## Validation

| Command                          | Covers                                        |
| -------------------------------- | --------------------------------------------- |
| `pnpm run typecheck`             | web + domain + database + api-client + mobile |
| `pnpm run typecheck:api`         | API                                           |
| `pnpm run bundle:api:check`      | `api/index.ts` matches source entry           |
| `pnpm run lint` / `format:check` | eslint + prettier                             |
| `pnpm run test`                  | web + domain + database + api-client + mobile |
| `pnpm run test:api`              | API + analytics golden parity                 |
| `pnpm run e2e`                   | Playwright chromium                           |

## Where is…

| Question           | Path                                                               |
| ------------------ | ------------------------------------------------------------------ |
| Progression math   | `packages/domain/src/generic-engine.ts`                            |
| API routes         | `apps/backend/api/src/routes/`                                     |
| Auth server        | `routes/auth.ts` + `services/auth.ts` + `middleware/auth-guard.ts` |
| Web OpenAPI client | `apps/frontend/web/src/lib/api/generated.ts`                       |
| Shared UI          | `apps/frontend/web/src/components/`                                |
| Migrations         | `packages/database/migrations/`                                    |
| Program seeds      | `packages/database/src/seeds/programs/`                            |
| Insights           | `apps/backend/api/src/analytics/`                                  |
| New shared type    | `packages/domain/src/schemas/`                                     |
| DB table change    | `packages/database/src/schema.ts` → `pnpm run db:generate`         |
| Prod infra         | `vercel.json` + `scripts/vercel-build.sh`                          |

## Other docs

| Path                                                             | Role                                |
| ---------------------------------------------------------------- | ----------------------------------- |
| `CLAUDE.md` / `AGENTS.md`                                        | Agent context (symlink)             |
| [`SUPPLY_CHAIN_SECURITY.md`](./SUPPLY_CHAIN_SECURITY.md)         | Dependency + secret policy          |
| [`DATABASE_SECURITY_ROLLOUT.md`](./DATABASE_SECURITY_ROLLOUT.md) | Deferred DB contracts / RLS risk    |
| [`api-and-db.md`](./api-and-db.md)                               | Auto-generated API + schema surface |
