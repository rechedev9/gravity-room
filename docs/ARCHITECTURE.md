# Architecture

pnpm monorepo: web + mobile + API, shared TS packages. Production runs
**same-origin on the VPS**: the `web` container (Caddy with the Vite SPA) and the
`api` container (Node with the ElysiaJS API). A push to `main` runs
`.github/workflows/deploy.yml`: the checks, then `rechedev9/vps-deploy` builds both
images and ships them, with a health check and a rollback. Agent contracts: root
`CLAUDE.md` / `AGENTS.md`.

## Layout

```
gravity-room/
├── apps/frontend/web/        ← React 19 + Vite SPA (PWA)
├── apps/frontend/mobile/     ← Expo 54 / RN
├── apps/backend/api/         ← ElysiaJS (create-app.ts; analytics under src/analytics)
├── packages/domain/          ← @gzclp/domain — Zod + GZCLP engine
├── packages/database/        ← @gzclp/database — schema, migrations, seeds
├── packages/api-client/      ← @gzclp/api-client — shared wire mechanics (paths, requests, errors)
├── packages/design-tokens/   ← @gzclp/design-tokens — shared colors, spacing, radii, type
├── scripts/                  ← loadtest, security checks
└── docs/                     ← this file + security runbooks
```

## Path map

| Path                                             | Role                                 | Run / test                         |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------- |
| `apps/frontend/web/`                             | React SPA, PWA                       | `pnpm run dev` / `test` / `e2e`    |
| `apps/frontend/web/src/features/`                | Feature UI                           | `pnpm --filter web test`           |
| `apps/frontend/web/src/components/`              | Shared UI + shell                    | vitest                             |
| `apps/frontend/web/src/lib/api/generated.ts`     | OpenAPI drift artifact (committed)   | `pnpm --filter web api:types`      |
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
| `packages/domain/`                               | GZCLP engine + Zod schemas           | `pnpm run test:domain`             |
| `packages/domain/src/generic-engine.ts`          | Progression engine                   | domain tests                       |
| `packages/database/`                             | Schema, migrations, seeds            | `pnpm run test:database`           |
| `packages/database/src/schema.ts`                | Tables / indexes                     | `pnpm run db:generate` after edits |
| `packages/api-client/`                           | Shared wire mechanics, no Zod        | `pnpm run test:api-client`         |
| `packages/design-tokens/`                        | Shared design tokens                 | `pnpm run test:design-tokens`      |
| `apps/frontend/web/src/styles/tokens.css`        | Generated from the tokens            | `pnpm --filter web tokens:css`     |
| `lefthook.yml`                                   | pre-commit / pre-push gates          | lefthook                           |

## Contracts

- **`@gzclp/domain`** — SoT for GZCLP rules + shared Zod. Never reimplement in apps.
- **`@gzclp/database`** — SoT for Postgres schema/migrations/seeds. API owns the pool only.
- **`generated.ts` is a drift artifact** — regenerate it after route changes (`api:types` with API up). It is not a runtime client and app code never imports it; web and mobile call the API through hand-written code on the shared builders.
- **Sharing** — training rules in `@gzclp/domain`, wire mechanics in `@gzclp/api-client`, visual tokens in `@gzclp/design-tokens`; see "Sharing rules" in `CLAUDE.md`.
- **Auth** — JWT access + refresh rotation; multi-method (Google, Apple, GitHub, Microsoft, email/password).
- **API is HTTP-only** — the `web` container serves the SPA; `create-app.ts` never serves assets.
- **Analytics in-process** — pipelines in `src/analytics/`, stored in `user_insights`, driven by cron `POST /api/internal/analytics/compute`. Golden parity: `__fixtures__/golden.json`. A series is one lift in one tier (`exerciseId:tier` when the lift has several tiers, the bare id otherwise; `@gzclp/domain/insight-series`), because T1 and T2 of a lift carry different loads.
- **Migrations once per deploy** — the `api` container runs `migrate-deploy` before the server (prod needs `DIRECT_DATABASE_URL`); no boot-time DDL in `create-app.ts`.

## Local dev

```bash
pnpm install
pnpm --filter api db:deploy
pnpm run dev:api    # :3001
pnpm run dev        # :5173
```

Postgres required (`DATABASE_URL`). Upstash Redis optional locally, required in prod.

## Validation

| Command                          | Covers                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `pnpm run typecheck`             | web + domain + database + api-client + design-tokens + mobile |
| `pnpm run typecheck:api`         | API                                                           |
| `pnpm run lint` / `format:check` | eslint + prettier                                             |
| `pnpm run test`                  | web + domain + database + api-client + design-tokens + mobile |
| `pnpm run test:api`              | API + analytics golden parity                                 |
| `pnpm run e2e`                   | Playwright chromium                                           |

## Where is…

| Question           | Path                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progression math   | `packages/domain/src/generic-engine.ts`                                                                                                                     |
| API routes         | `apps/backend/api/src/routes/`                                                                                                                              |
| Auth server        | `routes/auth.ts` + `services/auth.ts` + `middleware/auth-guard.ts`                                                                                          |
| API drift artifact | `apps/frontend/web/src/lib/api/generated.ts` (not imported)                                                                                                 |
| Shared UI          | `apps/frontend/web/src/components/`                                                                                                                         |
| Migrations         | `packages/database/migrations/`                                                                                                                             |
| Program seeds      | `packages/database/src/seeds/programs/`                                                                                                                     |
| Insights           | `apps/backend/api/src/analytics/`                                                                                                                           |
| New shared type    | Training rule or data shape → `packages/domain/src/`; paths, requests, errors → `packages/api-client/src/`; colors, spacing → `packages/design-tokens/src/` |
| DB table change    | `packages/database/src/schema.ts` → `pnpm run db:generate`                                                                                                  |
| Prod infra         | `.github/workflows/deploy.yml`, `apps/*/*/Dockerfile`, `rechedev9/vps-deploy`                                                                               |

## Other docs

| Path                                                             | Role                                |
| ---------------------------------------------------------------- | ----------------------------------- |
| `CLAUDE.md` / `AGENTS.md`                                        | Agent context (symlink)             |
| [`SUPPLY_CHAIN_SECURITY.md`](./SUPPLY_CHAIN_SECURITY.md)         | Dependency + secret policy          |
| [`DATABASE_SECURITY_ROLLOUT.md`](./DATABASE_SECURITY_ROLLOUT.md) | Deferred DB contracts / RLS risk    |
| [`api-and-db.md`](./api-and-db.md)                               | Auto-generated API + schema surface |
