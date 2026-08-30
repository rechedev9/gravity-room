# Gravity Room — agent context

GZCLP linear-progression weightlifting tracker. pnpm monorepo deployed as **one
same-origin Vercel project**: Vite SPA (static) + ElysiaJS API (serverless
`api/index.ts`).

Deeper docs only when needed: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
(layout + path map), [`docs/api-and-db.md`](./docs/api-and-db.md)
(`pnpm run context:refresh` with API up), [`.env.example`](./.env.example).

## Layout

| Path                             | Role                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/web`              | React 19 + Vite 7 SPA (TanStack Router/Query, Tailwind 4, i18next)                                                            |
| `apps/frontend/mobile`           | Expo 54 / RN (hand-written API calls; no generated client)                                                                    |
| `apps/backend/api`               | ElysiaJS API — `src/create-app.ts`; local `src/dev-server.ts`; Vercel source `src/vercel-handler.ts` → bundled `api/index.ts` |
| `apps/backend/api/src/analytics` | Insight pipelines (cron-driven; not a separate service)                                                                       |
| `apps/backend/api/src/routes`    | HTTP handlers                                                                                                                 |
| `packages/domain`                | `@gzclp/domain` — Zod schemas + GZCLP engine (**SoT for training rules**)                                                     |
| `packages/database`              | `@gzclp/database` — Drizzle schema, migrations, seeds                                                                         |
| `packages/api-client`            | Shared typed fetch helpers (web still uses OpenAPI codegen)                                                                   |
| `scripts/`                       | `vercel-build.sh`, `bundle-api-function.mjs`, loadtest, security checks                                                       |

## Hard contracts (do not violate)

1. **Domain SoT** — progression math, graduation, shared Zod schemas live only in
   `@gzclp/domain`. Never reimplement or clamp on top in app code.
2. **DB SoT** — schema/migrations/seeds only in `packages/database`. Edit
   `packages/database/src/schema.ts` → `pnpm run db:generate`. Migrations run
   **build-time** via `pnpm --filter api db:deploy` (advisory-locked,
   `DIRECT_DATABASE_URL` in prod) — **never** boot-time DDL in `create-app.ts`.
3. **Web API client is generated** — after route changes, with API running:
   `pnpm --filter web api:types` and commit
   `apps/frontend/web/src/lib/api/generated.ts`. Do not hand-edit it. Mobile does
   not use it.
4. **Errors** — `throw new ApiError(status, message, code)` from
   `middleware/error-handler.ts`. Do not set `set.status` in handlers.
5. **Transactions** — use `tx` inside `db.transaction(...)`; `.for('update')`
   before mutating a selected row.
6. **Auth** — JWT access + refresh rotation; access JWT carries `users.authVersion`
   (mismatch → reject). Soft-delete via `users.deletedAt` (30-day grace). Logic:
   `routes/auth.ts`, `services/auth.ts`, `middleware/auth-guard.ts`.
7. **Internal/cron** — `/api/internal/*` accepts `CRON_SECRET` or
   `INTERNAL_SECRET` Bearer; fails closed if neither set. Crons:
   `analytics/compute` + `maintenance` (see `vercel.json`).
8. **Same-origin prod** — `CORS_ORIGIN` empty, `VITE_API_URL=""`. Pooled
   `DATABASE_URL` at request time; direct `DIRECT_DATABASE_URL` only for
   migrations. Redis = Upstash REST only (`UPSTASH_REDIS_*`); optional locally,
   required in prod.
9. **New required-in-prod env** — update all three:
   `apps/backend/api/src/lib/env-validation.ts`, root `.env.example`, Vercel env
   (Production + Preview).

## Conventions

- No `as any`, no silence-casts, no non-null `!`. No barrel re-exports of foreign modules.
- Route I/O: TypeBox (`t` from `elysia`). Business/shared validation: Zod in `@gzclp/domain`.
- Independent async work → `Promise.all`.
- Web UI strings → i18next (`t` / `<Trans>`); 0 missing keys in every locale.
- Loading buttons → `isLoading` prop only.
- Images → WebP by default; do not rename existing asset extensions.
- If a change stale-ifies this file or `docs/`, fix refs in the same change.
- Lefthook runs typecheck/lint/format (pre-commit) and test/build (pre-push). No `--no-verify`.

## Commands

```bash
pnpm install
pnpm --filter api db:deploy   # once: migrations + seeds
pnpm run dev:api              # :3001
pnpm run dev                  # web :5173
pnpm run typecheck && pnpm run lint && pnpm run test
pnpm run test:api
pnpm run e2e
pnpm run bundle:api:check     # api/index.ts drift
```

Local setup details → skill `local-dev`. Deploy diagnosis → skill `vercel-deploy`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `rechedev9/gravity-room` (via the `gh` CLI). See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its name. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).

## Do not reintroduce

- Python analytics service, Docker/VPS/Caddy deploy, aggregate CI `Validate` workflow
- `/metrics` + prom-client, `REDIS_URL`, `METRICS_TOKEN`, `DB_POOL_SIZE`, `COMPUTE_INTERVAL_HOURS`
- Per-package `.env*.example` (root `.env.example` only)
- Boot-time DDL, cross-origin split in production

Active GitHub workflows: `ci-frontend.yml`, `ci-backend.yml`, `ci-infra.yml`, `production-smoke.yml`.
