# Tech Stack

> GZCLP Tracker is a workout tracker for the GZCLP linear progression program, built as a Bun monorepo with a Vite + React 19 SPA frontend and an ElysiaJS API backend.

## Contents

- [Runtime](#runtime)
  - [1. Bun 1.x](#1-bun-1x)
- [Frontend](#frontend)
  - [2. React 19.2](#2-react-192)
  - [3. Vite 7.3](#3-vite-73)
  - [4. Tailwind CSS 4](#4-tailwind-css-4)
  - [5. TanStack Query 5.90](#5-tanstack-query-590)
- [Backend](#backend)
  - [6. ElysiaJS 1.4](#6-elysiajs-14)
  - [7. PostgreSQL](#7-postgresql)
  - [8. Drizzle ORM 0.45](#8-drizzle-orm-045)
  - [9. Zod 4.3](#9-zod-43)
  - [10. Pino 10.3](#10-pino-103)
  - [11. prom-client 15.1](#11-prom-client-151)
  - [12. JWT Auth Strategy](#12-jwt-auth-strategy)
- [Developer Experience](#developer-experience)
  - [13. Playwright 1.58](#13-playwright-158)
  - [14. Lefthook 2.1](#14-lefthook-21)

---

## Runtime

### 1. Bun 1.x

Bun serves as the package manager, test runner, script runner, and runtime for the entire monorepo.

**Role in this project**: Every workspace script (`bun run dev`, `bun run build`, `bun run typecheck`) runs through Bun. The test suite uses `bun:test` directly — no separate test framework binary is installed. The API process runs as a native Bun process, not a Node.js process. The lockfile (`bun.lock`) tracks all workspace dependencies.

**Alternatives considered**: Node.js + npm, Node.js + pnpm, Deno.

**Why Bun**: Bun executes TypeScript natively in development, eliminating the `tsc --watch` or `ts-node` step that Node.js requires. The built-in `bun:test` runner removes Jest and Vitest from the dependency tree entirely. Install times are 25–50x faster than npm on a warm cache. ElysiaJS, the chosen backend framework, is designed specifically for the Bun runtime and degrades when run on Node.js compatibility layers. These factors make Bun the only runtime that satisfies all three layers of the stack (package management, testing, and backend execution) with a single binary.

Evidence: `package.json`

---

## Frontend

### 2. React 19.2

React 19.2 is the UI framework for the entire web application, rendering all views and managing component state.

**Role in this project**: Every component under `apps/web/src/` is a React component. The application uses `createBrowserRouter` from react-router-dom v7 with lazy-loaded routes to code-split the initial bundle. React 19's Compiler handles memoization automatically — the project's ESLint config enforces that manual `useMemo` and `useCallback` calls are not added.

**Alternatives considered**: Vue 3, Svelte 5, SolidJS, Angular.

**Why React 19**: The React 19 Compiler eliminates manual memoization overhead that prior React versions required. The `use()` hook simplifies async data consumption patterns. React has the largest ecosystem and broadest hiring pool of any frontend framework as of 2026, which reduces long-term maintenance risk. The combination of react-router-dom v7, TanStack Query 5, and React Testing Library is well-established and has no equivalent maturity in Vue or Svelte ecosystems.

Evidence: `apps/web/src/main.tsx`

---

### 3. Vite 7.3

Vite 7.3 is the development server and production bundler for the web SPA.

**Role in this project**: In development, Vite serves the app via native ES modules with near-instant hot module replacement. In production, it produces a chunked static bundle. The `vite.config.ts` defines manual chunk splitting — `vendor-react` and `vendor-query` — so the initial JS payload stays lean. The `@vitejs/plugin-react` plugin handles the React 19 Babel transform. Path alias `@/` maps to `apps/web/src/`.

**Alternatives considered**: webpack 5, esbuild (standalone), Parcel, Rollup direct.

**Why Vite**: Vite's native-ESM dev server eliminates the full-bundle rebuild that webpack requires on every file save, making the development loop noticeably faster for a project of this size. Its production builds use Rollup under the hood, which is well-tested and supports manual chunking without complex plugin configuration. The official `@vitejs/plugin-react` plugin integrates React 19 with zero configuration. webpack 5 and Parcel require substantially more config for the same output.

Evidence: `apps/web/vite.config.ts`

---

### 4. Tailwind CSS 4

Tailwind CSS 4 provides utility-first styling across all web components.

**Role in this project**: All component styling in `apps/web/src/` is expressed as Tailwind utility classes. There are no CSS Modules, no styled-components, and no inline styles. Tailwind 4 integrates with Vite via the `@tailwindcss/postcss` PostCSS plugin, so CSS is compiled to a static atomic stylesheet at build time. Design tokens (colors, spacing, typography) are defined as CSS variables — Tailwind 4 drops the `tailwind.config.js` file in favor of pure CSS-variable-based configuration.

**Alternatives considered**: CSS Modules, styled-components, vanilla CSS, UnoCSS.

**Why Tailwind CSS 4**: Tailwind generates zero runtime cost — the final CSS bundle contains only the classes actually used. It imposes no component library opinions, so the project can build any visual design without fighting a design system. Tailwind 4's PostCSS plugin integrates transparently with Vite's build pipeline without requiring a separate build step or configuration file. UnoCSS was evaluated but the Tailwind 4 ecosystem and tooling (IDE extensions, documentation) are more mature.

Evidence: `apps/web/package.json`

---

### 5. TanStack Query 5.90

TanStack Query 5.90 manages all server state in the web application: fetching, caching, mutation, and optimistic updates.

**Role in this project**: Every API call in the frontend is wrapped in a TanStack Query `useQuery` or `useMutation`. The central hook `use-program.ts` uses optimistic mutations with automatic cache rollback on error — this pattern is used for recording workout results, updating weights, and the undo operation. The query key factory in `query-keys.ts` provides a structured namespace that prevents cache key collisions across the application.

**Alternatives considered**: SWR, Zustand + manual fetch, Redux Toolkit Query, Apollo.

**Why TanStack Query**: The optimistic mutation pattern with automatic rollback is non-trivial to implement correctly without a library, and TanStack Query's implementation handles concurrent mutation edge cases (like the 401 refresh race) that a manual Zustand + fetch approach would need to solve independently. SWR lacks first-class mutation support. Redux Toolkit Query requires more boilerplate for the same result. TanStack Query's devtools are also useful during development for inspecting cache state.

Evidence: `apps/web/src/hooks/use-program.ts`

---

## Backend

### 6. ElysiaJS 1.4

ElysiaJS 1.4 is the HTTP framework for the API, handling routing, middleware, JWT auth, CORS, static file serving, and OpenAPI documentation.

**Role in this project**: The API entry point in `apps/api/src/index.ts` composes ElysiaJS plugins to build the full application: `@elysiajs/cors` for CORS headers, `@elysiajs/jwt` for access and refresh token signing, `@elysiajs/swagger` for auto-generated OpenAPI docs, and `@elysiajs/static` to serve the compiled SPA. Route handlers use ElysiaJS's schema inference to validate request bodies without a separate Zod layer.

**Alternatives considered**: Express 5, Fastify, Hono, NestJS.

**Why ElysiaJS**: ElysiaJS is designed specifically for the Bun runtime — it is not a Node.js framework with Bun compatibility shims. It provides end-to-end type safety via the Eden client without code generation. The plugin ecosystem covers every cross-cutting concern in this project (JWT, CORS, Swagger, static files) in a single, consistent API. NestJS was eliminated for its weight and decorator-heavy style. Express and Fastify are Node.js-first and lose ElysiaJS's type inference guarantees when running on Bun.

Evidence: `apps/api/src/index.ts`

---

### 7. PostgreSQL

PostgreSQL is the primary persistent store for users, program instances, workout results, the undo stack, and refresh token metadata.

**Role in this project**: The database schema defines five tables — users, program instances, workout results, undo events, and refresh tokens — with UUID primary keys, foreign key constraints with `ON DELETE CASCADE`, a JSONB column for flexible program configuration blobs, and partial indexes for performance. The Drizzle ORM sits on top of the `postgres.js` driver (version 3.4.8).

**Alternatives considered**: SQLite (libsql/Turso), MySQL, MongoDB, PlanetScale.

**Why PostgreSQL**: ACID compliance is a hard requirement for the undo stack, where data integrity on concurrent writes matters. JSONB support handles the flexible `programConfig` blob without requiring schema migrations every time a program definition changes. Relational foreign keys with `ON DELETE CASCADE` enforce referential integrity automatically. PostgreSQL has mature managed offerings on Railway, Neon, and Supabase, none of which introduce vendor lock-in. SQLite was considered for simplicity but lacks horizontal scalability and robust managed hosting.

Evidence: `apps/api/src/db/schema.ts`

---

### 8. Drizzle ORM 0.45

Drizzle ORM 0.45 is the query builder and migration tool for all database interactions in the API.

**Role in this project**: The schema in `apps/api/src/db/schema.ts` is the single source of truth for the database structure — tables, enums, relations, and indexes are defined as TypeScript code. `$inferSelect` and `$inferInsert` types derived from the schema flow directly into service functions, ensuring the TypeScript layer and the database layer cannot diverge. Drizzle Kit generates plain SQL migration files that are committed to the repository and applied on startup.

**Alternatives considered**: Prisma, TypeORM, Kysely, raw SQL.

**Why Drizzle ORM**: The schema-as-TypeScript approach eliminates a separate schema file (`.prisma`) and the Prisma binary download step in CI. `$inferSelect`/`$inferInsert` types propagate automatically without a code generation step. Drizzle Kit produces readable, reviewable SQL migration files. The runtime library is lightweight compared to Prisma's query engine. Parameterized queries are the default, so there is no SQL injection risk from string concatenation. A query logger in development aids debugging.

Evidence: `apps/api/src/db/schema.ts`, `apps/api/src/db/index.ts`

---

### 9. Zod 4.3

Zod 4.3 is the runtime schema validation library used in the shared package and the web application.

**Role in this project**: All data structures shared between the web and API — workout results, program instances, legacy schemas — are defined as Zod schemas in `packages/shared/src/schemas/`. TypeScript types are inferred from those schemas via `z.infer<>`, eliminating manual type duplication. The web application uses these schemas to validate API responses before they enter the TanStack Query cache. The `zod/v4` import path is used throughout, which is the standard Zod v4 module specifier. `z.strictObject()` rejects unknown keys at runtime.

**Alternatives considered**: Yup, Valibot, io-ts, ArkType.

**Why Zod 4.3**: `z.infer<>` is the most ergonomic way to derive TypeScript types from runtime schemas without duplication — Yup requires separate type declarations. Zod v4 is materially faster at parse time than v3, which matters for the shared package used on every request. Valibot and ArkType were evaluated but have smaller ecosystems. io-ts's functional style is unfamiliar to most developers. Zod's integration with ElysiaJS (via Elysia's type system) and TanStack Query's response handling is well-established.

Evidence: `packages/shared/src/schemas/instance.ts`

---

### 10. Pino 10.3

Pino 10.3 is the structured JSON logger for the API.

**Role in this project**: A single Pino instance is initialized in `apps/api/src/lib/logger.ts` and imported by route handlers and middleware throughout the API. All log output is structured JSON with fields for request method, path, status code, and latency. The `LOG_LEVEL` environment variable controls verbosity without code changes. Request logging and error logging use Pino's child logger pattern to attach request context.

**Alternatives considered**: Winston, Bunyan, `console.*`.

**Why Pino**: Pino is the fastest JSON logger available for Bun/Node.js environments, with per-call overhead measured in microseconds. Its structured output is parseable by log drains (Railway's log ingestion, external observability tools) without a custom parser. `console.log` is banned in production code per the project's ESLint rules. Winston's API is more verbose and slower. Bunyan is no longer actively maintained.

Evidence: `apps/api/src/lib/logger.ts`

---

### 11. prom-client 15.1

prom-client 15.1 exposes a Prometheus-compatible `/metrics` endpoint from the API.

**Role in this project**: The `metricsPlugin` in `apps/api/src/plugins/metrics.ts` instruments every HTTP request with duration histograms and request counters. A `normaliseRoute` function replaces UUIDs and numeric path segments with `:id` and `:n` placeholders before recording the route label, preventing high-cardinality Prometheus label explosion. The `/metrics` endpoint is token-protected. Default Node.js/Bun process metrics (memory, CPU, event loop lag) are also collected.

**Alternatives considered**: OpenTelemetry SDK, Datadog agent, custom metrics.

**Why prom-client**: prom-client is the de-facto standard library for exposing Prometheus metrics from a Node.js/Bun process. It integrates directly with Railway's metrics scraping infrastructure and any Grafana-based dashboard without vendor coupling. The OpenTelemetry SDK was evaluated but adds significantly more configuration overhead for a project that only needs request-level metrics. Datadog and other agents introduce per-seat cost and vendor lock-in.

Evidence: `apps/api/src/plugins/metrics.ts`

---

### 12. JWT Auth Strategy

The auth strategy uses short-lived JWT access tokens with long-lived refresh token rotation, implemented without a third-party auth service.

**Role in this project**: Access tokens are signed by `@elysiajs/jwt` (version 1.4.x) and stored in memory on the frontend — never in `localStorage` or `sessionStorage`. Refresh tokens are stored as SHA-256 hashes in the PostgreSQL `refresh_tokens` table (never plaintext). The frontend's `api.ts` implements a promise-based refresh mutex that prevents concurrent 401 responses from triggering parallel refresh races. A `previousTokenHash` chain in the database enables token reuse detection.

**Alternatives considered**: Sessions + Redis, Clerk, Auth0, Supabase Auth.

**Why this strategy**: Stateless access tokens scale horizontally without a shared session store — any API instance can verify a token with only the signing key. Storing refresh tokens as hashes means a database compromise does not leak usable tokens. Token reuse detection via `previousTokenHash` provides defense against refresh token theft. Clerk and Auth0 were evaluated but introduce per-seat costs and external service dependencies that are unnecessary for a project with full control over its auth logic.

Evidence: `apps/web/src/lib/api.ts`, `apps/api/src/services/auth.ts`

---

## Developer Experience

### 13. Playwright 1.58

Playwright 1.58 handles end-to-end browser testing for the web application.

**Role in this project**: E2E tests live in `apps/web/e2e/` with the `.spec.ts` extension. The Playwright config uses a `webServer` block that builds the SPA (`bun run build:web`) and starts the API (`bun run dev:api`) before the test suite runs — the E2E suite tests the production-built frontend against a real API. Chromium is the only browser target. The `@playwright/test` runner integrates with GitHub Actions via the built-in HTML reporter.

**Alternatives considered**: Cypress, Puppeteer, Selenium.

**Why Playwright**: Playwright is the current industry standard for E2E testing of modern SPAs. Restricting to Chromium only reduces flakiness that arises from cross-browser rendering differences, which are not a concern for a project that targets modern browsers. The `webServer` configuration handles build-and-serve orchestration natively. `bun:test` handles unit and component tests; Playwright handles E2E — this clean separation means each tool operates in its appropriate scope. Cypress's architecture introduces iframe-based limitations and its Bun support is less mature.

Evidence: `apps/web/playwright.config.ts`

---

### 14. Lefthook 2.1

Lefthook 2.1 is the git hook runner that enforces code quality before commits and pushes.

**Role in this project**: The `lefthook.yml` at the repository root defines two hooks. The pre-commit hook runs `bun run typecheck`, `bun run lint`, and `bun run format:check` in parallel. The pre-push hook runs `bun run test` and `bun run build` in parallel. Parallel execution means the pre-commit hook completes in the time of the slowest individual check rather than the sum of all checks.

**Alternatives considered**: Husky, simple-git-hooks, manual shell scripts.

**Why Lefthook**: Lefthook's parallel hook execution is its primary advantage — pre-commit runs typecheck, lint, and format simultaneously, not serially. Husky runs commands sequentially by default and requires additional configuration for parallelism. Lefthook is a single binary with a YAML config at the repo root, which is simpler than Husky's multi-file setup. It works natively with Bun without any compatibility shims.

Evidence: `lefthook.yml`

---

_Versions current as of 2026-02-22. Update this document when upgrading major dependencies._
