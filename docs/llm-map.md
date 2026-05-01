# LLM Map — path → purpose

A one-page navigation map for Gravity Room. Each row is a directory or file
plus what lives there and which test/run command exercises it. Designed for
agents and quick onboarding.

For the architectural rationale, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Apps

| Path                                         | Tier     | Role                                                                 | Tech                                          | Run / test                                                                 |
| -------------------------------------------- | -------- | -------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/frontend/web/`                         | frontend | React SPA, PWA                                                       | Vite 7, React 19, TanStack Router, Tailwind 4 | `bun run dev` / `bun run test` / `bun run --filter web e2e`                |
| `apps/frontend/web/src/features/`            | frontend | Feature-folder UI (auth, dashboard, home, insights, etc.)            | React + TanStack Query                        | covered by `bun run --filter web test`                                     |
| `apps/frontend/web/src/components/`          | frontend | Shared UI primitives + app-shell (root-layout, providers)            | Radix UI + Tailwind                           | unit tests via bun:test                                                    |
| `apps/frontend/web/src/lib/api/generated.ts` | frontend | OpenAPI-generated Zod client (committed)                             | openapi-zod-client                            | `bun run --filter web api:types` regenerates it; lefthook checks for drift |
| `apps/frontend/web/codegen/`                 | frontend | Codegen sources for `lib/api/generated.ts`                           | Bun TS scripts                                | `bun test apps/frontend/web/codegen/generate-api-types.test.ts`            |
| `apps/frontend/web/e2e/`                     | frontend | Playwright specs (chromium)                                          | Playwright 1.58                               | `bun run --filter web e2e`                                                 |
| `apps/frontend/mobile/`                      | frontend | Expo / RN client                                                     | Expo 54, RN 0.81, expo-sqlite                 | `bun run --filter mobile typecheck` / Jest                                 |
| `apps/backend/api/`                          | backend  | REST API                                                             | ElysiaJS 1.4 on Bun                           | `bun run dev:api` / `bun run test:api`                                     |
| `apps/backend/api/src/routes/`               | backend  | HTTP route handlers (auth, programs, catalog, etc.)                  | Elysia                                        | `bun test apps/backend/api/src/routes`                                     |
| `apps/backend/api/src/services/`             | backend  | Business logic (1:1 with routes)                                     | TS                                            | `bun test apps/backend/api/src/services`                                   |
| `apps/backend/api/src/middleware/`           | backend  | auth-guard, error-handler, rate-limit, request-logger                | Elysia plugins                                | unit tests in same folder                                                  |
| `apps/backend/api/src/lib/`                  | backend  | redis, logger, sentry, caches, telegram, google-auth                 | TS                                            | unit tests in same folder                                                  |
| `apps/backend/api/src/db/`                   | backend  | Drizzle schema + seeds (catalog, programs, exercises, muscle groups) | Drizzle ORM 0.45 + postgres                   | `bun run --filter api db:migrate` / seeds tests                            |
| `apps/backend/api/drizzle/`                  | backend  | Generated SQL migrations                                             | drizzle-kit                                   | applied on bootstrap                                                       |
| `apps/backend/api/Dockerfile`                | backend  | Production API image                                                 | Bun base                                      | `docker compose build api`                                                 |
| `apps/backend/analytics/`                    | backend  | Python insights microservice                                         | FastAPI 0.115, psycopg 3, sklearn             | `pytest` (in folder) / `ruff check .`                                      |
| `apps/backend/analytics/insights/`           | backend  | e1RM, frequency, summary, volume calculators                         | numpy/pandas                                  | `pytest tests/`                                                            |
| `apps/backend/analytics/ml/`                 | backend  | forecast, plateau, recommendation models                             | scikit-learn                                  | unit tests                                                                 |

## Shared

| Path                                    | Role                                                                           | Test                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `packages/domain/`                      | `@gzclp/domain` workspace package — Zod schemas + GZCLP engine                 | `bun run test:domain`                                 |
| `packages/domain/src/schemas/`          | Catalog, exercises, insights, instance, program-definition, user, workout-rows | covered by domain tests                               |
| `packages/domain/src/generic-engine.ts` | GZCLP progression engine                                                       | `bun test packages/domain/src/generic-engine.test.ts` |

## Tooling

| Path                                                  | Role                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `scripts/committer`                                   | bash helper to author Conventional Commit messages                             |
| `scripts/loadtest.js`                                 | k6 load test (smoke / load / stress)                                           |
| `lefthook.yml`                                        | pre-commit (typecheck, lint, format) + pre-push (test, build, api-types-drift) |
| `tsconfig.base.json`                                  | shared TypeScript compiler options                                             |
| `.prettierrc` / `.prettierignore`                     | repo-wide formatting                                                           |
| `docker-compose.dev.yml`                              | dev compose with postgres + redis                                              |
| `.github/workflows/validate.yml`                      | per-service paths-filter, dispatches reusable workflows                        |
| `.github/workflows/_validate-{web,api,analytics}.yml` | per-service validation pipelines                                               |
| `.github/workflows/auto-format.yml`                   | runs prettier + ruff on PRs                                                    |

## Docs

| Path                   | Role                                                |
| ---------------------- | --------------------------------------------------- |
| `docs/ARCHITECTURE.md` | architectural overview (this layout's rationale)    |
| `docs/llm-map.md`      | this file                                           |
| `docs/roadmap.md`      | living roadmap (gitignored, not committed)          |
| `docs/log.md`          | deploy and progress log (gitignored, not committed) |
| `docs/issues.md`       | known issues (gitignored, not committed)            |
| `README.md`            | top-level entry point                               |

## Agent / planning

| Path                                   | Role                                              |
| -------------------------------------- | ------------------------------------------------- |
| `.weave/plans/`                        | Weave plan files (markdown front-matter + steps)  |
| `.weave/runtime/`                      | Session JSONs (gitignored)                        |
| `.weave/scratch/`                      | Working notes (gitignored)                        |
| `.agents/skills/gravity-room/SKILL.md` | Auto-discovered repo conventions for agents       |
| `.codex/`                              | Codex CLI agent config                            |
| `openspec/`                            | Spec-driven change workflow (proposals → archive) |

## Quick "where do I look for…"

| Question                                           | Path                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "Where is the workout progression logic?"          | `packages/domain/src/generic-engine.ts`                                                                        |
| "Where do API routes live?"                        | `apps/backend/api/src/routes/`                                                                                 |
| "Where is auth handled on the server?"             | `apps/backend/api/src/routes/auth.ts` + `services/auth.ts` + `middleware/auth-guard.ts` + `lib/google-auth.ts` |
| "Where is the OpenAPI client used by the web app?" | `apps/frontend/web/src/lib/api/generated.ts` (do not edit by hand)                                             |
| "Where is shared UI?"                              | `apps/frontend/web/src/components/` (vs feature-local under `features/`)                                       |
| "Where is the SPA Dockerfile?"                     | `apps/frontend/web/Dockerfile` (nginx)                                                                         |
| "Where is the API Dockerfile?"                     | `apps/backend/api/Dockerfile`                                                                                  |
| "Where are migrations?"                            | `apps/backend/api/drizzle/`                                                                                    |
| "Where are program seeds?"                         | `apps/backend/api/src/db/seeds/programs/`                                                                      |
| "Where is the analytics insights logic?"           | `apps/backend/analytics/insights/`                                                                             |
| "Where do I add a new shared type?"                | `packages/domain/src/schemas/` (Zod schema, infer the type)                                                    |
