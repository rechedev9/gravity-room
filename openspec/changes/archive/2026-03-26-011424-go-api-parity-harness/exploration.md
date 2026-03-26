---
summary: Exploration for go-api-parity-harness — HTTP contract test harness enabling TS vs Go response comparison across every migration slice.
read_when: Starting proposal or design phase for the parity harness change.
---

# Exploration: go-api-parity-harness

**Change ID:** go-api-parity-harness
**Phase:** explore
**Date:** 2026-03-26

---

## Current State

The TS API has two distinct test layers today:

1. **Unit/route integration tests** (`bun:test`, `apps/api/src/**/*.test.ts`) — use Elysia's in-process `.handle()`, heavily mock services and DB. Fast, hermetic, no real network or DB. 31 test files.
2. **Playwright E2E tests** (`apps/web/e2e/**/*.spec.ts`) — browser-level, hit a real running server at `http://localhost:3001`, use a `/auth/dev` dev-only endpoint to seed test users. 19 spec files.

There is **no HTTP contract test layer** today — no tests that fire real HTTP requests at the live TS API server and capture/assert full response shapes. The parity harness needs to be a new, third test layer that:

- Sends real HTTP requests to a running TS API (and, later, Go API)
- Asserts exact JSON structure, key names (camelCase), null vs. omit behavior, date formats, cookie attributes, status codes, and response headers
- Can run the identical test suite against both servers by changing a base URL env var

The existing E2E helpers in `apps/web/e2e/helpers/api.ts` are the closest analog — they hit real endpoints via `page.request` — but they are browser-bound (Playwright Page context) and test-outcome-oriented, not shape-asserting.

---

## 2. Current Test Infrastructure

### 2.1 Unit and Route Integration Tests (`bun:test`)

**Pattern** (`apps/api/src/routes/auth.test.ts:1-119`):

- First line: `process.env['LOG_LEVEL'] = 'silent'` suppresses Pino noise.
- All mocks declared before module import (Bun requirement).
- Services mocked via `mock.module('../services/...', ...)`.
- Route wrapped in a minimal Elysia app with the real error handler replicated inline.
- HTTP dispatched via `testApp.handle(new Request('http://localhost/...', { ... }))`.
- Assertions on `res.status` and `await res.json()`.

**Coverage of response shapes:** minimal. Tests assert status codes and a handful of key fields (`body.accessToken`, `body.user.email`). They do not assert:

- The complete JSON structure of success responses
- null vs. omit behavior for optional fields
- ISO date format
- Response headers (Cache-Control, x-request-id, set-cookie attributes)

**Test ordering:** the `test` script in `apps/api/package.json:9` runs tests in a specific serialized order to avoid parallel DB conflicts — relevant because any new DB-backed harness must respect this or run in isolation.

**No shared request helpers:** each route test file defines its own local `get()` / `post()` helpers. No shared HTTP client utility exists.

### 2.2 Playwright E2E Tests

**Pattern** (`apps/web/e2e/auth.spec.ts`, `helpers/api.ts`):

- `createAndAuthUser(page)` → `POST /api/auth/dev` to create a user and get an `accessToken`.
- Subsequent calls use `page.request.post/get` with `Authorization: Bearer <token>`.
- Cookies are automatically managed by Playwright's browser context.
- The `playwright.config.ts` (`apps/web/playwright.config.ts:28-33`) starts the server with `bun run build:web && bun run dev:api`.
- Base URL: `http://localhost:3001` (`apps/web/e2e/helpers/api.ts:4`).

**What they test:** UI flows, not HTTP contract shapes. They call APIs to seed state, then drive the browser.

**What they don't test:** exact JSON field names, null vs. omit, date format, cookie `path` attribute, `Retry-After` header, etc.

### 2.3 Existing DB-backed E2E Integration Tests (API-level)

`apps/api/test/db-setup.ts` and `apps/api/test/helpers.ts` establish a thin scaffolding for running service-layer tests against a real test PostgreSQL DB (`DATABASE_URL_TEST`). `helpers.ts:7` imports `hashPassword` from `services/auth` — indicating this was written for a password-auth era and may reference stale schema. This layer never reached full HTTP round-trip coverage.

### 2.4 Gaps Relevant to the Harness

| Gap                                             | Impact on Go migration                                            |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| No full-shape assertion on any success response | Cannot catch Go field name or null/omit divergence                |
| No header assertions (except a few in E2E)      | Cannot catch missing Cache-Control, set-cookie path, x-request-id |
| No date format assertions                       | `time.RFC3339Nano` vs `.toISOString()` drift (Risk 2 in contract) |
| No cookie attribute assertions                  | Cookie `path=/api/auth` drift (Risk 4)                            |
| No cross-server base-URL parameterization       | Cannot run same tests against Go                                  |
| No fixture capture from live TS API             | No golden baseline to diff against                                |

---

## 3. Contract Surface Area

Source: `openspec/contract/http-contract.md` (2123 lines, pinned SHA `bef5a51`).

### 3.1 Endpoint Inventory

**Auth routes (7 endpoints):**

- `POST /api/auth/google` — sets cookie, returns `{ user, accessToken }`
- `POST /api/auth/dev` — dev-only, returns `{ user, accessToken }`, 404 in production
- `POST /api/auth/refresh` — rotates cookie, returns `{ accessToken }`
- `POST /api/auth/signout` — 204, clears cookie
- `GET /api/auth/me` — returns user shape
- `PATCH /api/auth/me` — updates profile, validates avatar
- `DELETE /api/auth/me` — 204, soft-delete

**Program routes (8 endpoints):**

- `GET /api/programs` — cursor-paginated list
- `POST /api/programs` — create instance
- `GET /api/programs/:id` — get instance (Redis-cached, singleflight)
- `PATCH /api/programs/:id` — update
- `PATCH /api/programs/:id/metadata` — JSONB shallow merge
- `DELETE /api/programs/:id` — 204
- `GET /api/programs/:id/export` — export shape
- `POST /api/programs/import` — bulk import

**Result routes (3 endpoints):**

- `POST /api/programs/:id/results` — upsert result
- `DELETE /api/programs/:id/results/:workoutIndex/:slotId` — delete result
- `POST /api/programs/:id/undo` — LIFO undo

**Catalog routes (3 endpoints):**

- `GET /api/catalog` — public, Cache-Control
- `GET /api/catalog/:programId` — public, Cache-Control
- `POST /api/catalog/preview` — auth-required, compute-only

**Exercise routes (3 endpoints):**

- `GET /api/exercises` — optional auth, offset-paginated
- `GET /api/muscle-groups` — public
- `POST /api/exercises` — auth-required, slug generation

**Program definition routes (6 endpoints):**

- `POST /api/program-definitions`
- `GET /api/program-definitions`
- `POST /api/program-definitions/fork`
- `GET /api/program-definitions/:id`
- `PUT /api/program-definitions/:id`
- `DELETE /api/program-definitions/:id`
- `PATCH /api/program-definitions/:id/status`

**System routes (3):**

- `GET /health` — `{ status, timestamp, uptime, db, redis }`
- `GET /metrics` — Prometheus text
- `GET /api/stats/online` — `{ count: number|null }`

**Total:** ~33 distinct endpoint patterns.

### 3.2 High-Risk Shape Details (contract §9, §17)

These are the serialization details most likely to diverge between TS and Go:

| Detail                                                                                         | Contract ref   | Harness must assert                                   |
| ---------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| camelCase keys throughout                                                                      | §9             | Key enumeration on all response objects               |
| `name`, `avatarUrl` always-present-null on User                                                | §9             | `"name": null` present, not absent                    |
| `metadata`, `definitionId`, `customDefinition` always-present-null on ProgramInstanceResponse  | §9             | same                                                  |
| `results`, `undoHistory`, `resultTimestamps`, `completedDates` always empty `{}`/`[]` not null | §9, §17 Risk 3 | assert type and value                                 |
| `amrapReps`, `rpe`, `setLogs` in result rows: omitted-when-null                                | §9             | assert key absent, not null                           |
| ISO 8601 `.000Z` (exactly 3 fractional digits)                                                 | §9             | regex `/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/` |
| Cursor format `<ISO>_<UUID>` at `lastIndexOf('_')`                                             | §10            | parse and validate                                    |
| Cookie `path=/api/auth`, `httpOnly`, `sameSite=Strict`                                         | §7             | parse `set-cookie` header                             |
| `Cache-Control: public, max-age=300, stale-while-revalidate=60` on `GET /catalog`              | §8             | exact string match                                    |
| Undo response omits `prevRpe` and `prevAmrapReps`                                              | §17 Risk 8     | assert keys absent                                    |
| Error shape `{ error, code }` — no other keys                                                  | §5             | exact key set                                         |
| 204 responses have empty body                                                                  | various        | `res.text() === ''`                                   |

### 3.3 Auth Patterns to Cover

- **Public:** `GET /catalog`, `GET /catalog/:id`, `GET /muscle-groups`, `GET /api/stats/online`, `GET /health`
- **Cookie-only:** `POST /auth/refresh`, `POST /auth/signout`
- **Bearer token:** all other protected routes
- **Optional auth:** `GET /api/exercises` (different cache behavior)
- **Dev-only:** `POST /api/auth/dev` (harness entry point — this is how tests create users)

---

## 4. Dependency Map

### 4.1 Existing Test Tooling

| Tool               | Where used                  | Role in harness                |
| ------------------ | --------------------------- | ------------------------------ |
| `bun:test`         | `apps/api/src/**/*.test.ts` | Unit / route integration       |
| `@playwright/test` | `apps/web/e2e/`             | Browser E2E                    |
| Elysia `.handle()` | route tests                 | In-process HTTP dispatch       |
| `drizzle-orm`      | `apps/api/test/db-setup.ts` | DB seeding for DB-backed tests |

### 4.2 What the Harness Needs

- **HTTP client:** must fire real network requests. Options:
  - Native `fetch` (available in Bun) — zero additional dependency
  - `undici` — more control over raw headers, redirects
  - Playwright's `APIRequestContext` (headless, no browser) — available via `@playwright/test`'s `request` fixture
- **Test runner:** bun:test is the natural choice (already used everywhere, no setup overhead).
- **Cookie jar:** manual header management or `undici` `CookieJar`. The harness must capture `set-cookie` from auth responses and replay `Cookie` headers.
- **Server under test:** requires a real running TS API with real PostgreSQL. Use `DATABASE_URL_TEST` + the existing `db-setup.ts` pattern, or rely on a pre-running server at `BASE_URL`.
- **JWT generation:** for tests needing pre-authorized tokens, use `POST /api/auth/dev` (the existing Playwright E2E approach) — no need to hand-roll JWTs.

### 4.3 No New External Dependencies Required

`fetch` + `bun:test` cover 95% of needs. Cookie management requires ~20 lines of manual `Set-Cookie` parsing. No additional npm packages are strictly necessary.

---

## 5. Risk Assessment

### 5.1 Blast Radius

The harness is a **new top-level test layer**. It does not modify existing code. Risk of breaking existing tests: none if placed in a new directory (e.g., `apps/api/test/contract/` or a new `apps/harness/` workspace).

### 5.2 Test Infrastructure Coupling

- Requires a real PostgreSQL test DB (`DATABASE_URL_TEST`).
- Requires a real running TS API server (either started by the test runner or pre-running).
- The E2E tests already require this (`playwright.config.ts` webServer block). The harness can follow the same pattern.

### 5.3 Test Coverage Gaps That Will Remain After Harness

| Gap                                                               | Reason                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Redis-specific behavior (singleflight, cache invalidation timing) | Cannot assert Redis internal state from HTTP; would need Redis CLI probes        |
| Rate limit sliding window precision                               | Would need many rapid requests and tight timing — fragile                        |
| Background jobs (token cleanup, Telegram)                         | Fire-and-forget; not observable from HTTP                                        |
| `POST /auth/google` (real Google JWT)                             | Requires a live Google credential; use `/auth/dev` for all harness user creation |
| Sentry integration                                                | Not observable from HTTP                                                         |

### 5.4 Shape Divergence Detection Latency

Without the harness, a Go serialization bug (e.g., `time.RFC3339Nano` emitting 9 fractional digits) would only be caught when a client breaks in production. With the harness running in CI against both servers, detection is pre-merge.

### 5.5 Ordering / Parallelism Risk

The existing `bun test` script runs tests in a specific serialized order (`apps/api/package.json:9`) to prevent parallel DB conflicts. Contract tests that mutate data (POST/PATCH/DELETE) must either:

- Run serially (simplest)
- Use isolated user/program IDs per test (preferred for speed)

The `/auth/dev` endpoint produces unique users per call (using `crypto.randomUUID()` in the email — `apps/web/e2e/helpers/api.ts:33`), so test isolation is achievable without serialization.

---

## 6. Approach Comparison

### Approach A: Snapshot / Golden-File Based

**Mechanism:** Run the harness against the live TS API once, serialize every response body + headers to JSON files under `openspec/fixtures/`. On subsequent runs (or against Go), load the golden file and deep-diff the actual response.

**Pros:**

- Zero manual schema writing — the TS API defines the truth automatically.
- Catches regressions in the TS API itself (golden files serve as a change detector).
- Diffing is precise: exact byte-level comparison reveals field name changes, extra/missing keys, date format drift.
- New fixture capture can be re-run at any commit to refresh the baseline.

**Cons:**

- Golden files encode incidental details: specific UUIDs, specific timestamps. Need a normalizer that replaces UUID values with `<uuid>` and timestamps with `<iso-date>` before comparison, while still asserting the _format_ is correct.
- The normalizer itself is non-trivial for deeply nested JSONB (`config`, `definition`, `customDefinition`) where some fields are structural (should be compared) and some are values (should be normalized).
- Re-baselining must be intentional and reviewed — accidental re-baselines hide regressions.
- File churn in git for every seeded data shape change.

**Verdict:** Good for full-surface-area regression detection but requires a normalizer that is itself a source of bugs.

### Approach B: Schema-Based (Zod / TypeBox validation)

**Mechanism:** Define expected response shapes as Zod schemas (or TypeBox, already used in Elysia). For each endpoint, assert `schema.safeParse(body).success === true` and assert specific semantic properties (null vs. omit, date regex, header values).

**Pros:**

- Schemas are readable, version-controlled, and serve as living documentation.
- No normalization needed — schemas express structural constraints, not values.
- Can run against both TS and Go identically with no setup.
- Incrementally extensible: add a new endpoint slice, add a schema, add tests.
- Zod is already a transitive dependency via `@gzclp/shared`.

**Cons:**

- Schemas must be manually written per endpoint — duplicating information already in `http-contract.md`.
- Schema validation cannot catch _exact_ field name drift in all cases (e.g., if both `camelCase` and `snake_case` satisfy a generic `string` schema). Must combine with explicit key enumeration.
- Cannot detect field _ordering_ differences (not relevant for JSON, but relevant for streaming).

**Verdict:** Cleanest architecture for incremental migration slices. Each slice = one schema + one test file.

### Approach C: Dual-Run Diff (Proxy-Based)

**Mechanism:** Run a proxy that forwards every test request to both TS and Go simultaneously and diffs the responses in real-time. Tests only define the request; the proxy handles comparison.

**Pros:**

- No schema writing. Diff is automatic.
- Can shadow-test Go against real production traffic shape during migration.

**Cons:**

- Requires both servers to be running simultaneously — significant infrastructure complexity.
- Diff output is hard to read for JSONB blobs and variable timestamps.
- Cannot express intentional differences (e.g., Go responds 204 where TS responded 200 during a correction phase).
- Overkill for the current migration stage.

**Verdict:** Useful for production shadow-testing later; too heavyweight for a development harness.

### Recommendation

**Approach B (Schema-Based) as primary, with selective golden-file capture for complex shapes.**

Specific design:

- Per-endpoint test files in a new `apps/api/test/contract/` directory (or a new `apps/harness/` Bun workspace).
- Zod schemas for response shapes — importing from `@gzclp/shared` where types already exist.
- Explicit key enumeration tests (use `Object.keys(body).sort()` assertions) to catch camelCase drift.
- Date format assertions via regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`.
- Cookie attribute assertions via manual `Set-Cookie` header parsing.
- `BASE_URL` env var to toggle between TS (`http://localhost:3001`) and Go (configurable port).
- User/program seeding via `POST /api/auth/dev` + `POST /api/programs` — same as Playwright E2E helpers.
- Optional: golden-file capture script for `ProgramInstanceResponse` (the most complex shape) that normalizes UUIDs and timestamps before writing.

---

## 7. Open Questions

### BLOCKING

**B1. Where does the harness live?**
Three options with different tradeoffs:

- `apps/api/test/contract/` — co-located with API, uses existing `db-setup.ts`, runs with `bun test:e2e`. Risk: entangles harness lifecycle with TS API codebase; makes it harder to point at Go.
- New workspace `apps/harness/` — independent Bun workspace, imports no TS API internals, purely HTTP. Cleanest separation; the harness is a black-box client of whichever server is at `BASE_URL`.
- `openspec/harness/` — co-located with the contract document. Not a Bun workspace; would need its own `package.json`. Unconventional.

**Recommendation:** `apps/harness/` as a new Bun workspace. This mirrors how E2E tests are in `apps/web/e2e/` without being inside `apps/api/`. Needs explicit user approval before proceeding.

**B2. Server lifecycle during harness runs**
Does the harness start its own server (like Playwright's `webServer` config) or require a pre-running server?

- Self-starting: more portable for CI, but adds startup time and requires `DATABASE_URL_TEST` to be set.
- Pre-running: simpler harness, but requires manual server management. Matches how Playwright is run today (`reuseExistingServer: !process.env.CI`).

**Recommended:** pre-running for local development (same as Playwright), self-starting for CI. Needs decision.

**B3. Do we capture golden fixtures now or only write schema tests?**
Golden capture requires a running TS API and produces checked-in JSON files. If we go schema-only first, we can add golden capture later as an optional enhancement. Which approach is in scope for Lote 1?

### DEFERRED

**D1. How to handle `POST /api/auth/google` (real Google JWT)?**
The harness cannot synthesize real Google JWTs. All user creation in the harness should use `POST /api/auth/dev`. The Google OAuth flow will not be covered by the harness — it requires E2E browser tests (already existing in `apps/web/e2e/auth.spec.ts`). This is acceptable for migration parity.

**D2. Rate limit endpoint tests**
Testing rate limiting requires sending many rapid requests. This is fragile in CI and would need a dedicated low-threshold endpoint or mock Redis. Defer to a separate harness slice.

**D3. Metrics endpoint format**
`GET /metrics` returns Prometheus text format, not JSON. Requires a different assertion strategy (line-by-line, metric name presence). Can be deferred until the Go Prometheus integration is implemented.

**D4. `POST /api/catalog/preview` test cases**
This endpoint accepts a full `ProgramDefinition` as request body — the largest and most complex input in the API. Testing it fully requires constructing valid definitions. The existing `catalog.test.ts:183-228` has a complete `VALID_DEFINITION_PAYLOAD` that can be lifted directly. Defer full coverage to the catalog migration slice.

**D5. Go server port assignment**
The harness needs to know the Go server port at runtime. Recommend `GO_API_URL` env var (e.g., `http://localhost:8080`) alongside `TS_API_URL` (default `http://localhost:3001`). The test runner selects which via `BASE_URL=process.env.GO_API_URL ?? process.env.TS_API_URL ?? 'http://localhost:3001'`. Implementation detail for proposal phase.

---

## Relevant Files

| File                                           | Relevance                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/api/src/routes/auth.test.ts:1-119`       | Canonical route test pattern — mock setup, `.handle()`, status assertions                        |
| `apps/api/src/routes/programs.test.ts`         | Auth guard pattern; validation boundary tests                                                    |
| `apps/api/src/routes/catalog.test.ts:111-118`  | Only existing `Cache-Control` header assertion in unit tests                                     |
| `apps/api/src/routes/results.test.ts`          | Minimal result route tests                                                                       |
| `apps/api/test/db-setup.ts`                    | DB seeding scaffolding (DATABASE_URL_TEST redirect, migrations)                                  |
| `apps/api/test/helpers.ts`                     | Factory helpers for DB-backed tests (partially stale schema)                                     |
| `apps/web/e2e/helpers/api.ts`                  | `createAndAuthUser`, `createTestProgram`, `seedResultsViaAPI` — direct model for harness helpers |
| `apps/web/e2e/helpers/seed.ts`                 | `seedProgram`, `authenticateOnly` — higher-level composition                                     |
| `apps/web/e2e/helpers/fixtures.ts`             | `DEFAULT_WEIGHTS`, `buildSuccessResults` — reusable test data                                    |
| `apps/web/playwright.config.ts`                | webServer lifecycle pattern                                                                      |
| `apps/api/package.json:9`                      | Test ordering constraint                                                                         |
| `openspec/contract/http-contract.md`           | Single source of truth for all HTTP behavior                                                     |
| `openspec/contract/http-contract.md:1752-1823` | §9 JSON Serialization Rules — the serialization contract the harness must enforce                |
| `openspec/contract/http-contract.md:2033-2122` | §17 Risks — 15 specific Go pitfalls, each a target test case                                     |
