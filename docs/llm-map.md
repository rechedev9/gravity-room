# LLM Map — path → purpose

A one-page navigation map for Gravity Room. Each row is a directory or file
plus what lives there and which test/run command exercises it. Designed for
agents and quick onboarding.

For the architectural rationale, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Apps

| Path                                                     | Tier     | Role                                                                                                      | Tech                                          | Run / test                                                        |
| -------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `apps/frontend/web/`                                     | frontend | React SPA, PWA                                                                                            | Vite 7, React 19, TanStack Router, Tailwind 4 | `pnpm run dev` / `pnpm run test` / `pnpm --filter web e2e`        |
| `apps/frontend/web/src/features/`                        | frontend | Feature-folder UI (auth, dashboard, home, insights, etc.)                                                 | React + TanStack Query                        | covered by `pnpm --filter web test`                               |
| `apps/frontend/web/src/components/`                      | frontend | Shared UI primitives + app-shell (root-layout, providers)                                                 | Radix UI + Tailwind                           | unit tests via vitest                                             |
| `apps/frontend/web/src/lib/api/generated.ts`             | frontend | OpenAPI-generated Zod client (committed)                                                                  | openapi-zod-client                            | `pnpm --filter web api:types` regenerates it; CI checks for drift |
| `apps/frontend/web/codegen/`                             | frontend | Codegen sources for `lib/api/generated.ts`                                                                | tsx TS scripts                                | `vitest run apps/frontend/web/codegen/generate-api-types.test.ts` |
| `apps/frontend/web/e2e/`                                 | frontend | Playwright specs (chromium)                                                                               | Playwright 1.58                               | `pnpm --filter web e2e`                                           |
| `apps/frontend/mobile/`                                  | frontend | Expo / RN client                                                                                          | Expo 54, RN 0.81, expo-sqlite                 | `pnpm --filter mobile typecheck` / Jest                           |
| `apps/frontend/mobile/src/lib/api/transport.ts`          | frontend | Mobile adapter for shared authenticated transport; program/catalog reads and creation                     | `@gzclp/api-client` + domain parsers          | `pnpm --filter mobile test`                                       |
| `apps/frontend/mobile/src/lib/auth/session-lifecycle.ts` | frontend | Durable account/SQLite owner isolation, token publication, sign-out cleanup and outbox flush triggers     | TypeScript                                    | `pnpm --filter mobile test`                                       |
| `apps/backend/api/`                                      | backend  | REST API                                                                                                  | ElysiaJS 1.4 on Node                          | `pnpm run dev:api` / `pnpm run test:api`                          |
| `apps/backend/api/src/routes/`                           | backend  | HTTP route handlers (auth, programs, catalog, etc.)                                                       | Elysia                                        | `vitest run apps/backend/api/src/routes`                          |
| `apps/backend/api/src/routes/auth-boundary.ts`           | backend  | Credential-request trust, avatar, device and profile-name boundary policy                                 | TypeScript                                    | API route tests                                                   |
| `apps/backend/api/src/routes/auth-oauth.ts`              | backend  | Shared OAuth state-cookie, SPA callback and safe provider-error policy                                    | TypeScript                                    | API route tests                                                   |
| `apps/backend/api/src/services/`                         | backend  | Business logic (1:1 with routes)                                                                          | TS                                            | `vitest run apps/backend/api/src/services`                        |
| `apps/backend/api/src/middleware/`                       | backend  | auth-guard, error-handler, rate-limit, request-logger                                                     | Elysia plugins                                | unit tests in same folder                                         |
| `apps/backend/api/src/lib/`                              | backend  | redis, logger, sentry, caches, telegram, google-auth                                                      | TS                                            | unit tests in same folder                                         |
| `apps/backend/api/src/db/`                               | backend  | API-owned Postgres connection/pool + dev seed entrypoint                                                  | Drizzle ORM 0.45 + postgres                   | used by API services                                              |
| `apps/backend/api/src/scripts/migrate-deploy.ts`         | backend  | Advisory-locked migrations + seeds against required production DIRECT_DATABASE_URL                        | drizzle-kit + Drizzle ORM                     | `pnpm --filter api db:deploy`                                     |
| `apps/backend/api/src/analytics/`                        | backend  | TS insight pipelines (e1RM, frequency, summary, volume, forecast, plateau, recommendation) + Cron compute | TypeScript                                    | `vitest run apps/backend/api/src/analytics`                       |
| `apps/backend/api/src/vercel-handler.ts`                 | backend  | Independent Vercel source entry → bounded streaming Node gateway                                          | TypeScript + Vercel Node                      | `pnpm run bundle:api:check` + API tests                           |
| `api/index.ts`                                           | backend  | Generated, committed Vercel serverless catch-all bundle                                                   | Vercel Node runtime                           | `pnpm run bundle:api:check`                                       |
| `packages/database/`                                     | database | Drizzle schema, migrations, reference seeds, schema dump tooling                                          | drizzle-kit + Drizzle ORM                     | `pnpm run test:database` / `pnpm run db:generate`                 |
| `packages/database/migrations/`                          | database | Generated SQL migrations                                                                                  | drizzle-kit                                   | applied by `db:deploy` (build-time)                               |
| `packages/api-client/`                                   | shared   | `@gzclp/api-client` JSON/auth transport and shared fetch utilities                                        | TypeScript                                    | `pnpm run test:api-client`                                        |

## Shared

| Path                                                         | Role                                                                                  | Test                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/domain/`                                           | `@gzclp/domain` workspace package — Zod schemas + GZCLP engine                        | `pnpm run test:domain`                                  |
| `packages/domain/src/schemas/`                               | Catalog, exercises, insights, instance, program-definition, user, workout-rows        | covered by domain tests                                 |
| `packages/domain/src/generic-engine.ts`                      | GZCLP progression engine                                                              | `vitest run packages/domain/src/generic-engine.test.ts` |
| `packages/database/src/schema.ts`                            | Postgres tables, relations, indexes                                                   | `pnpm run typecheck:database`                           |
| `packages/database/src/seeds/`                               | Reference data: muscle groups, exercises, program templates                           | `pnpm run test:database`                                |
| `packages/database/src/seeds/catalog-definition-registry.ts` | Single read-only preset JSONB registry for DB seeding and web prerender tooling       | `pnpm run test:database`                                |
| `packages/api-client/src/transport.ts`                       | Authenticated JSON transport with runtime parsers, cancellation and one refresh/retry | `pnpm run test:api-client`                              |

## Tooling

| Path                                            | Role                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `scripts/committer`                             | bash helper to author Conventional Commit messages                      |
| `scripts/bundle-api-function.mjs`               | generate/check `api/index.ts` from the independent source entry         |
| `scripts/loadtest.js`                           | k6 load test (smoke / load / stress)                                    |
| `scripts/check-architecture-boundaries.ts`      | executable dependency-direction policy for runtime apps/shared packages |
| `scripts/check-architecture-boundaries.test.ts` | table-driven policy fixtures                                            |
| `.github/workflows/production-smoke.yml`        | Post-deploy/daily production deep-link and action-header checks         |
| `lefthook.yml`                                  | pre-commit (typecheck, lint, format) + pre-push (test, build)           |
| `tsconfig.base.json`                            | shared TypeScript compiler options                                      |
| `.prettierrc` / `.prettierignore`               | repo-wide formatting                                                    |

## Docs

| Path                                | Role                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `docs/ARCHITECTURE.md`              | architectural overview (this layout's rationale)       |
| `docs/VERCEL_CUTOVER.md`            | Vercel same-origin go-live runbook                     |
| `docs/SUPPLY_CHAIN_SECURITY.md`     | Dependency, immutable CI input, and secret-scan policy |
| `docs/DATABASE_SECURITY_ROLLOUT.md` | Deferred DB contracts and accepted RLS risk            |
| `docs/llm-map.md`                   | this file                                              |
| `CLAUDE.md`                         | auto-loaded agent context (live API + DB schema)       |
| `README.md`                         | top-level entry point                                  |

## Quick "where do I look for…"

| Question                                           | Path                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Where is the workout progression logic?"          | `packages/domain/src/generic-engine.ts`                                                                                                                                                                                                 |
| "Where do API routes live?"                        | `apps/backend/api/src/routes/`                                                                                                                                                                                                          |
| "Where is auth handled on the server?"             | Route composition: `routes/auth.ts`; request/data policy: `routes/auth-boundary.ts`; OAuth policy: `routes/auth-oauth.ts`; mutations: `services/auth.ts`; authorization: `middleware/auth-guard.ts`; provider adapters: `lib/*-auth.ts` |
| "Where is the mobile session/account boundary?"    | `apps/frontend/mobile/src/lib/auth/session-lifecycle.ts` + `lib/auth/secure-storage.ts` + `lib/db/client.ts`                                                                                                                            |
| "Which mobile calls use the shared transport?"     | Adapter: `apps/frontend/mobile/src/lib/api/transport.ts`; consumers: `lib/programs/program-service.ts` and `lib/tracker/program-detail-service.ts`                                                                                      |
| "Where is the OpenAPI client used by the web app?" | `apps/frontend/web/src/lib/api/generated.ts` (do not edit by hand)                                                                                                                                                                      |
| "Where is shared UI?"                              | `apps/frontend/web/src/components/` (vs feature-local under `features/`)                                                                                                                                                                |
| "Where are migrations?"                            | `packages/database/migrations/`                                                                                                                                                                                                         |
| "Where are program seeds?"                         | `packages/database/src/seeds/programs/`                                                                                                                                                                                                 |
| "Where is the preset definition registry?"         | `packages/database/src/seeds/catalog-definition-registry.ts` (seed + web prerender build tooling)                                                                                                                                       |
| "Where is the analytics insights logic?"           | `apps/backend/api/src/analytics/` (TypeScript, Cron-driven)                                                                                                                                                                             |
| "Where do I add a new shared type?"                | `packages/domain/src/schemas/` (Zod schema, infer the type)                                                                                                                                                                             |
| "Where do I change a DB table/index?"              | `packages/database/src/schema.ts`, then `pnpm run db:generate`                                                                                                                                                                          |
| "Where is production infra?"                       | `vercel.json` + `scripts/vercel-build.sh` (same-origin Vercel); runbook in `docs/VERCEL_CUTOVER.md`                                                                                                                                     |
| "Where are dependency boundaries enforced?"        | `scripts/check-architecture-boundaries.ts`; `pnpm run architecture:test` + `pnpm run architecture:check`; policy steps in CI job `format` scan web/mobile/backend runtime and shared packages                                           |
