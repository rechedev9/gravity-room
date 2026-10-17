# Gravity Room — agent context

GZCLP linear-progression weightlifting tracker. pnpm monorepo deployed as **one
same-origin Vercel project**: Vite SPA (static) + ElysiaJS API (serverless
`api/index.ts`).

Deeper docs only when needed: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
(layout + path map), [`docs/api-and-db.md`](./docs/api-and-db.md)
(`pnpm run context:refresh` with API up), [`.env.example`](./.env.example).

## Punk Records

Shared standing law for every agent that touches this repo. If it is not here, it did not happen. Update this block in the same PR when a law changes.

- **Prove It Works.** Verify the real path, not a proxy. CI, lint, and typecheck are supplemental. Do not call a user-visible change done from code reading alone.
- **PR quality CI** (PRs and `main`): `CI frontend`, `CI backend`, `CI infra`. Not Playwright e2e. Not a hit on gravityroom.app.
- **Claude review is off** (King, 2026-08-30). Do not restore `claude.yml` or `claude-code-review.yml`.
- **Production smoke stays:** `.github/workflows/production-smoke.yml` against https://gravityroom.app after Production deploy / cron. Do not run it on PRs.

## Layout

| Path                             | Role                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/web`              | React 19 + Vite 7 SPA (TanStack Router/Query, Tailwind 4, i18next)                                                            |
| `apps/frontend/mobile`           | Expo 54 / RN (hand-written API calls; no generated client)                                                                    |
| `apps/backend/api`               | ElysiaJS API — `src/create-app.ts`; local `src/dev-server.ts`; Vercel source `src/vercel-handler.ts` → bundled `api/index.ts` |
| `apps/backend/api/src/analytics` | Insight pipelines (cron-driven; not a separate service)                                                                       |
| `apps/backend/api/src/routes`    | HTTP handlers                                                                                                                 |
| `packages/domain`                | `@gzclp/domain` — Zod schemas + GZCLP engine + every rule web and mobile share (**SoT for training rules**)                   |
| `packages/database`              | `@gzclp/database` — Drizzle schema, migrations, seeds                                                                         |
| `packages/api-client`            | Wire mechanics web and mobile share: path encoding, request builders, error decoding, cursor paging. No training rules        |
| `packages/design-tokens`         | `@gzclp/design-tokens` — colors, spacing, radii, type scale; web CSS is generated from it, mobile imports it                  |
| `scripts/`                       | `vercel-build.sh`, `bundle-api-function.mjs`, loadtest, security checks                                                       |

## Hard contracts (do not violate)

1. **Domain SoT** — progression math, graduation, shared Zod schemas, result and
   undo reducers, workout-complete rules and weight-unit conversion live only in
   `@gzclp/domain`. Never reimplement or clamp on top in app code.
2. **Server DB SoT** — Postgres schema/migrations/seeds only in `packages/database`. Edit
   `packages/database/src/schema.ts` → `pnpm run db:generate`. Migrations run
   **build-time** via `pnpm --filter api db:deploy` (advisory-locked,
   `DIRECT_DATABASE_URL` in prod) — **never** boot-time DDL in `create-app.ts`. Mobile offline SQLite has a separate
   [storage contract](docs/agents/mobile-storage.md) in `apps/frontend/mobile/src/lib/db`.
3. **`generated.ts` is a drift artifact, not a client** — after route changes, with
   API running: `pnpm --filter web api:types` and commit
   `apps/frontend/web/src/lib/api/generated.ts`. Do not hand-edit it and do not
   import it from app code (its header forbids it; only tests read it). Web and
   mobile make their requests through hand-written code on the shared builders
   and `@gzclp/domain` schemas.
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

## Sharing rules (web and mobile)

Put code in the package by what it is, not by who uses it first. A rule that is
duplicated in `apps/frontend/web` and `apps/frontend/mobile` belongs in a package.

| It is                                                                                            | It goes in               |
| ------------------------------------------------------------------------------------------------ | ------------------------ |
| A training or data rule: engine, reducers, completion, units, defaults, limits, response schemas | `packages/domain`        |
| Wire mechanics with no training meaning: path encoding, request builders, `ApiError`, paging     | `packages/api-client`    |
| A color, spacing, radius, font or type size                                                      | `packages/design-tokens` |
| Credentials and tokens, storage, refresh orchestration, outbox, retry policy, query keys, i18n   | the app, on purpose      |

- Import the package subpath (`@gzclp/domain/slot-results`). Never keep a copy and
  never add a re-export shim in an app.
- `packages/api-client` holds no credentials, no storage and no Zod. Web `lib/api.ts`
  and `lib/api-core.ts` sit in the entry chunk of every page: import only Zod-free
  subpaths there.
- To change a design token, edit `packages/design-tokens/src/tokens.ts` and run
  `pnpm --filter web tokens:css`. The generated `tokens.css` is committed and a test
  fails when it drifts.
- Backend route I/O stays TypeBox. It takes constants and types from `@gzclp/domain`
  and does not depend on `@gzclp/api-client`.
- The weight unit is an account field (`users.weight_unit`). Stored weights are always
  kg; the unit only changes display and input.

## Conventions

- No `as any`, no silence-casts, no non-null `!`. No barrel re-exports of foreign modules.
- Route I/O: TypeBox (`t` from `elysia`). Business/shared validation: Zod in `@gzclp/domain`.
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

Mobile changes: follow the [quality and dependency gates](docs/agents/mobile-quality.md)
and its linked storage, sync and timer ownership guides.

### Issue tracker

Issues live as GitHub issues in `rechedev9/gravity-room` (via the `gh` CLI). See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its name. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context. The repo has no `CONTEXT.md` or `docs/adr/` yet, so there is no glossary or ADR to read; create them at the repo root when terms or decisions get resolved. See [`docs/agents/domain.md`](./docs/agents/domain.md).

## Do not reintroduce

- Python analytics service, Docker/VPS/Caddy deploy, aggregate CI `Validate` workflow, Claude review
- `/metrics` + prom-client, `REDIS_URL`, `METRICS_TOKEN`, `DB_POOL_SIZE`, `COMPUTE_INTERVAL_HOURS`
- Per-package `.env*.example` (root `.env.example` only)
- Boot-time DDL, cross-origin split in production
