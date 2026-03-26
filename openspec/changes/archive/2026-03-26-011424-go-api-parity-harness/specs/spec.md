# Delta Spec: HTTP Parity Harness

**Change**: go-api-parity-harness
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

The Gravity Room TS API lacks a black-box HTTP contract test layer. Unit tests use in-process `.handle()` and assert minimal response fields; Playwright E2E tests drive the browser and ignore response shapes. This change adds a new `apps/harness/` Bun workspace that sends real HTTP requests to a running server and asserts exact response shapes, headers, cookies, and serialization rules defined in `http-contract.md`. The same test suite runs against either the TS or Go server by switching `BASE_URL`.

No existing specs exist in `openspec/specs/`. All requirements are ADDED.

---

## ADDED Requirements

### REQ-HARNESS-001: Workspace Structure

The harness **MUST** exist as a new Bun workspace at `apps/harness/` with its own `package.json`. The root `package.json` `workspaces` glob (`"apps/*"`) already covers this path, so no root manifest change is required. The harness **MUST NOT** import any module from `apps/api/` — it is a pure HTTP client.

The `package.json` **MUST** declare:

- `name`: `"harness"` (or `"@gzclp/harness"`)
- `private`: `true`
- A `test` script that runs `bun test` against `src/tests/`
- `zod` as a dependency (for response schema validation)
- No dependency on `elysia`, `drizzle-orm`, or any other `apps/api` internal

The workspace **MUST** contain at minimum:

- `src/helpers/` — HTTP client, cookie jar, seeding utilities
- `src/schemas/` — Zod response schemas per route group
- `src/tests/` — one test file per route group

#### Scenario: Workspace resolves in monorepo install · `code-based` · `critical`

- **WHEN** `bun install` is run from the monorepo root
- **THEN** `node_modules` resolution includes `apps/harness/` and `bun run --filter harness test` executes the harness test script

#### Scenario: Harness has no API internal imports · `code-based` · `critical`

- **WHEN** a static analysis scans all `import` and `require` statements in `apps/harness/src/**/*.ts`
- **THEN** zero imports resolve to paths under `apps/api/` or `@gzclp/api`

#### Scenario: Monorepo test pipeline includes harness · `code-based` · `critical`

- **WHEN** `bun run test` is run from the monorepo root
- **THEN** the harness test script is executed as part of the workspace filter `--filter '*'`

---

### REQ-HARNESS-002: HTTP Client Helpers

The harness **MUST** provide a shared HTTP client module that wraps native `fetch`. The client **MUST** support:

1. **Base URL resolution** — all request paths are resolved against `BASE_URL` (env var, default `http://localhost:3001`).
2. **Bearer token injection** — an `authFetch(path, options, accessToken)` function that sets `Authorization: Bearer <token>`.
3. **Cookie jar** — a `CookieJar` class that captures `Set-Cookie` headers from responses and replays `Cookie` headers on subsequent requests to matching paths.

The cookie jar **MUST** parse at least these `Set-Cookie` attributes: `path`, `httpOnly`, `secure`, `sameSite`, `maxAge`. It **MUST** handle multiple `Set-Cookie` headers on a single response (via `response.headers.getSetCookie()`).

The client **MUST NOT** depend on any external HTTP library (`undici`, `axios`, `got`, `@playwright/test`).

#### Scenario: BASE_URL defaults to localhost:3001 · `code-based` · `critical`

- **WHEN** `BASE_URL` is not set in the environment
- **THEN** all requests target `http://localhost:3001`

#### Scenario: BASE_URL overrides target server · `code-based` · `critical`

- **GIVEN** `BASE_URL` is set to `http://localhost:8080`
- **WHEN** the client sends a request to `/api/health`
- **THEN** the request is sent to `http://localhost:8080/api/health`

#### Scenario: Cookie jar captures refresh token · `code-based` · `critical`

- **WHEN** a `POST /api/auth/dev` response includes a `Set-Cookie: refresh_token=<value>; Path=/api/auth; HttpOnly; SameSite=Strict` header
- **THEN** the cookie jar stores the cookie with `name=refresh_token`, `path=/api/auth`, `httpOnly=true`, `sameSite=Strict`

#### Scenario: Cookie jar replays cookies on matching path · `code-based` · `critical`

- **GIVEN** the cookie jar contains `refresh_token` with `path=/api/auth`
- **WHEN** a request is sent to `POST /api/auth/refresh`
- **THEN** the request includes `Cookie: refresh_token=<stored-value>` header

#### Scenario: Cookie jar does not send cookies to non-matching paths · `code-based` · `standard`

- **GIVEN** the cookie jar contains `refresh_token` with `path=/api/auth`
- **WHEN** a request is sent to `GET /api/programs`
- **THEN** the request does NOT include a `Cookie` header with `refresh_token`

---

### REQ-HARNESS-003: Auth Seeding

Each test **MUST** seed its own isolated user via `POST /api/auth/dev` with a unique email of the form `harness-<uuid>@test.local`. The seeding helper **MUST** return an object containing at minimum `{ email, accessToken, userId }` and the cookie jar populated with the `refresh_token` cookie.

The harness **MUST** also provide a `createTestProgram(accessToken)` helper that creates a GZCLP program instance via `POST /api/programs` and returns the instance `id`.

#### Scenario: Seed creates unique user per call · `code-based` · `critical`

- **WHEN** `seedUser()` is called twice in the same test file
- **THEN** each call returns a different `email` and `userId`

#### Scenario: Seed returns valid access token · `code-based` · `critical`

- **WHEN** `seedUser()` returns `{ accessToken }`
- **THEN** a `GET /api/auth/me` request with `Authorization: Bearer <accessToken>` returns HTTP 200

#### Scenario: Seed populates cookie jar with refresh token · `code-based` · `critical`

- **WHEN** `seedUser()` completes
- **THEN** the returned cookie jar contains a `refresh_token` cookie with `path=/api/auth`

#### Scenario: Dev endpoint unavailable in production · `code-based` · `standard`

- **GIVEN** the target server is running with `NODE_ENV=production`
- **WHEN** `POST /api/auth/dev` is called
- **THEN** the response is HTTP 404

---

### REQ-HARNESS-004: Zod Strict Schemas

For each route group, the harness **MUST** define Zod schemas with `.strict()` for every success response shape. `.strict()` causes validation to fail if the response JSON contains any key not declared in the schema.

The following route groups **MUST** have schemas:

1. **auth** — `UserResponse`, `AuthResponse` (`{ user, accessToken }`), `RefreshResponse` (`{ accessToken }`)
2. **programs** — `ProgramInstanceResponse`, `ProgramListResponse` (with cursor pagination), `ExportResponse`, `ImportResponse`
3. **results** — `ResultResponse`, `UndoResponse`
4. **catalog** — `CatalogListResponse`, `CatalogDetailResponse`
5. **exercises** — `ExerciseListResponse`, `MuscleGroupsResponse`, `CreateExerciseResponse`
6. **program-definitions** — `ProgramDefinitionResponse`, `ProgramDefinitionListResponse`
7. **system** — `HealthResponse`, `StatsOnlineResponse`

Each schema file **MUST** include a comment citing the contract section it is derived from (e.g., `// http-contract.md §9, §8`).

#### Scenario: Strict schema rejects unexpected key · `code-based` · `critical`

- **GIVEN** the `UserResponse` schema defines keys `id`, `email`, `name`, `avatarUrl`, `createdAt`, `updatedAt`
- **WHEN** a response body `{ id: "...", email: "...", name: null, avatarUrl: null, createdAt: "...", updatedAt: "...", role: "admin" }` is validated
- **THEN** `schema.safeParse(body).success` is `false` with an error referencing the unexpected key `role`

#### Scenario: Strict schema accepts valid TS API response · `code-based` · `critical`

- **WHEN** `GET /api/auth/me` returns a valid response from the live TS API
- **THEN** `UserResponseSchema.safeParse(body).success` is `true`

#### Scenario: Schema references contract section in comments · `code-based` · `standard`

- **WHEN** reading `apps/harness/src/schemas/auth.ts`
- **THEN** the file contains a comment line matching `/http-contract\.md/`

---

### REQ-HARNESS-005: Key Enumeration Assertions

In addition to Zod `.strict()` schemas, high-risk response shapes **MUST** have explicit `Object.keys(body).sort()` assertions to detect camelCase-vs-snake_case drift at the top level.

The following shapes **MUST** have key enumeration assertions:

- `User` object (from `GET /api/auth/me`)
- `ProgramInstanceResponse` (from `GET /api/programs/:id`)
- Individual result entries within the `results` map
- `UndoResponse` (from `POST /api/programs/:id/undo`)
- Error responses

#### Scenario: User object keys are exactly the expected set · `code-based` · `critical`

- **WHEN** `GET /api/auth/me` returns a user object
- **THEN** `Object.keys(body).sort()` deep-equals `["avatarUrl", "createdAt", "email", "id", "name", "updatedAt"]`

#### Scenario: Error response keys are exactly error and code · `code-based` · `critical`

- **WHEN** a request to a protected endpoint without auth returns HTTP 401
- **THEN** `Object.keys(body).sort()` deep-equals `["code", "error"]`

#### Scenario: snake_case key detected as failure · `code-based` · `critical`

- **GIVEN** a Go server returns `{ "avatar_url": null }` instead of `{ "avatarUrl": null }`
- **WHEN** the key enumeration assertion runs
- **THEN** the assertion fails because `avatar_url` is not in the expected key set

---

### REQ-HARNESS-006: Null-vs-Omit Assertions

The harness **MUST** assert the correct null-vs-omit behavior for every field listed in contract section 9.

**Always-present-possibly-null** fields — the harness **MUST** assert the key exists in the response object (via `"key" in body`) even when the value is `null`:

- `User`: `name`, `avatarUrl`
- `ProgramInstanceResponse`: `metadata`, `definitionId`, `customDefinition`
- Paginated list: `nextCursor`
- `ProgramDefinitionResponse`: `deletedAt`
- `ExerciseEntry`: `equipment`, `createdBy`, `force`, `level`, `mechanic`, `category`, `secondaryMuscles`
- `StatsOnline`: `count`

**Omitted-when-null** fields — the harness **MUST** assert the key is absent from the response object when the value would be null:

- Result row fields: `amrapReps`, `rpe`, `setLogs`
- Undo history entry: `prev`, `prevRpe`, `prevAmrapReps`, `prevSetLogs`

**Always-present empty collections** — the harness **MUST** assert the key exists and is an empty object/array (not `null`, not omitted):

- `ProgramInstanceResponse`: `results` = `{}`, `undoHistory` = `[]`, `resultTimestamps` = `{}`, `completedDates` = `{}`

#### Scenario: User name field is present with null value · `code-based` · `critical`

- **WHEN** `POST /api/auth/dev` returns a new user
- **THEN** `body.user` contains the key `name` with value `null` (i.e., `"name" in body.user === true` AND `body.user.name === null`)

#### Scenario: Fresh program has empty collections not null · `code-based` · `critical`

- **GIVEN** a user creates a new program via `POST /api/programs`
- **WHEN** `GET /api/programs/:id` returns the program instance
- **THEN** `body.results` deep-equals `{}`, `body.undoHistory` deep-equals `[]`, `body.resultTimestamps` deep-equals `{}`, `body.completedDates` deep-equals `{}`

#### Scenario: Result row omits amrapReps when not set · `code-based` · `critical`

- **GIVEN** a workout result is submitted with `result: "success"` (no AMRAP data)
- **WHEN** `GET /api/programs/:id` returns the program with the result
- **THEN** the result entry does NOT contain the key `amrapReps` (i.e., `"amrapReps" in resultEntry === false`)

#### Scenario: Undo response omits prevRpe and prevAmrapReps · `code-based` · `critical`

- **GIVEN** a workout result exists for a program
- **WHEN** `POST /api/programs/:id/undo` is called
- **THEN** the response body does NOT contain keys `prevRpe` or `prevAmrapReps` (contract Risk 8)

---

### REQ-HARNESS-007: ISO Date Format Assertions

Every timestamp field in every response **MUST** be validated against the regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`, which enforces exactly 3 fractional digits and a `Z` suffix matching JavaScript's `Date.toISOString()`.

The harness **SHOULD** provide a shared assertion helper `expectISODate(value: string)` that applies this regex.

Fields that **MUST** be validated:

- `User`: `createdAt`, `updatedAt`
- `ProgramInstanceResponse`: `createdAt`, `updatedAt`, `completedAt`
- All timestamp values in `resultTimestamps` map
- All timestamp values in `completedDates` map
- `ProgramDefinitionResponse`: `createdAt`, `updatedAt`, `deletedAt` (when non-null)
- `HealthResponse`: `timestamp`

#### Scenario: User createdAt has exactly 3 fractional digits · `code-based` · `critical`

- **WHEN** `GET /api/auth/me` returns a user
- **THEN** `body.createdAt` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`

#### Scenario: Go RFC3339Nano format is rejected · `code-based` · `critical`

- **GIVEN** a timestamp value is `"2024-01-15T10:30:00.123456789Z"` (9 fractional digits)
- **WHEN** `expectISODate("2024-01-15T10:30:00.123456789Z")` is called
- **THEN** the assertion fails because the regex requires exactly 3 fractional digits

#### Scenario: Timestamp without fractional seconds is rejected · `code-based` · `critical`

- **GIVEN** a timestamp value is `"2024-01-15T10:30:00Z"` (no fractional digits)
- **WHEN** `expectISODate("2024-01-15T10:30:00Z")` is called
- **THEN** the assertion fails

---

### REQ-HARNESS-008: Cursor Format Assertions

For cursor-paginated endpoints (`GET /api/programs`), the harness **MUST** validate cursor format when `nextCursor` is non-null.

A valid cursor **MUST** be a string where splitting at `lastIndexOf('_')` yields:

1. A left part matching the ISO date regex from REQ-HARNESS-007
2. A right part matching a UUID v4 regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

#### Scenario: nextCursor has valid format · `code-based` · `critical`

- **GIVEN** a user has more programs than fit in one page
- **WHEN** `GET /api/programs` returns with `nextCursor` non-null
- **THEN** splitting `nextCursor` at `lastIndexOf('_')` produces a valid ISO timestamp and a valid UUID v4

#### Scenario: nextCursor is null when no more pages · `code-based` · `standard`

- **GIVEN** a user has fewer programs than the page size
- **WHEN** `GET /api/programs` returns
- **THEN** `body.nextCursor` is `null` (present, not omitted)

---

### REQ-HARNESS-009: Cookie Attribute Assertions

For endpoints that set cookies (`POST /api/auth/dev`, `POST /api/auth/google`, `POST /api/auth/refresh`), the harness **MUST** parse the `Set-Cookie` header and assert the following attributes on the `refresh_token` cookie:

| Attribute  | Expected Value |
| ---------- | -------------- |
| `path`     | `/api/auth`    |
| `httpOnly` | `true`         |
| `sameSite` | `Strict`       |

The harness **SHOULD** also assert `maxAge` equals `604800` (7 days in seconds).

For `POST /api/auth/signout`, the harness **MUST** assert the `Set-Cookie` header clears the cookie (e.g., `maxAge=0` or `Expires` in the past).

#### Scenario: Dev auth sets refresh_token with correct attributes · `code-based` · `critical`

- **WHEN** `POST /api/auth/dev` returns with a `Set-Cookie` header
- **THEN** the `refresh_token` cookie has `path=/api/auth`, `httpOnly=true`, `sameSite=Strict`

#### Scenario: Signout clears refresh_token cookie · `code-based` · `critical`

- **GIVEN** a user is authenticated with a valid refresh token
- **WHEN** `POST /api/auth/signout` is called
- **THEN** the `Set-Cookie` header for `refresh_token` sets `maxAge=0` or an `Expires` date in the past

#### Scenario: Cookie path drift detected · `code-based` · `critical`

- **GIVEN** a server sets `Set-Cookie: refresh_token=abc; Path=/auth` (missing `/api` prefix)
- **WHEN** the cookie attribute assertion runs
- **THEN** the assertion fails because `path` is `/auth` not `/api/auth`

---

### REQ-HARNESS-010: Cache-Control Header Assertions

The harness **MUST** assert exact `Cache-Control` header values on cacheable endpoints:

| Endpoint                      | Expected Cache-Control                           |
| ----------------------------- | ------------------------------------------------ |
| `GET /api/catalog`            | `public, max-age=300, stale-while-revalidate=60` |
| `GET /api/catalog/:programId` | `public, max-age=300, stale-while-revalidate=60` |

The assertion **MUST** be an exact string match, not a substring or header-field parse.

#### Scenario: Catalog list returns exact Cache-Control · `code-based` · `critical`

- **WHEN** `GET /api/catalog` returns
- **THEN** `response.headers.get('Cache-Control')` equals `"public, max-age=300, stale-while-revalidate=60"`

#### Scenario: Catalog detail returns exact Cache-Control · `code-based` · `critical`

- **WHEN** `GET /api/catalog/gzclp` returns
- **THEN** `response.headers.get('Cache-Control')` equals `"public, max-age=300, stale-while-revalidate=60"`

---

### REQ-HARNESS-011: Error Shape Assertions

Every error response **MUST** match the shape `{ error: string, code: string }` with no additional keys. The harness **MUST** define a `ErrorResponseSchema = z.object({ error: z.string(), code: z.string() }).strict()` and validate all non-2xx responses against it.

#### Scenario: 401 unauthorized has exact error shape · `code-based` · `critical`

- **WHEN** `GET /api/auth/me` is called without an `Authorization` header
- **THEN** the response is HTTP 401 and the body validates against `ErrorResponseSchema` with `code: "UNAUTHORIZED"`

#### Scenario: 404 not found has exact error shape · `code-based` · `critical`

- **WHEN** `GET /api/programs/00000000-0000-4000-8000-000000000000` is called (non-existent ID)
- **THEN** the response is HTTP 404 and `Object.keys(body).sort()` deep-equals `["code", "error"]`

#### Scenario: Validation error has exact error shape · `code-based` · `critical`

- **WHEN** `POST /api/programs` is called with an empty body `{}`
- **THEN** the response is HTTP 400 and body has `code: "VALIDATION_ERROR"` with no extra keys

---

### REQ-HARNESS-012: Empty Body for 204 Responses

Every endpoint that returns HTTP 204 **MUST** have an empty response body. The harness **MUST** assert `await response.text() === ""` for all 204 responses.

Endpoints returning 204:

- `POST /api/auth/signout`
- `DELETE /api/programs/:id`
- `DELETE /api/programs/:id/results/:workoutIndex/:slotId`
- `DELETE /api/program-definitions/:id`

#### Scenario: Signout returns empty 204 · `code-based` · `critical`

- **GIVEN** a user is authenticated
- **WHEN** `POST /api/auth/signout` is called
- **THEN** `response.status` is `204` AND `await response.text()` is `""`

#### Scenario: Program delete returns empty 204 · `code-based` · `critical`

- **GIVEN** a user owns a program
- **WHEN** `DELETE /api/programs/:id` is called
- **THEN** `response.status` is `204` AND `await response.text()` is `""`

---

### REQ-HARNESS-013: Test Isolation

Each test file **MUST** create its own user and program data via the seeding helpers. Tests **MUST NOT** share users, programs, or any mutable state across test files. This ensures tests are parallel-safe.

Within a single test file, tests **MAY** share a user seeded in a `beforeAll` block if the tests are read-only or if mutations are scoped to data created within the test.

The harness **MUST NOT** require a specific test execution order across files.

#### Scenario: Two test files run in parallel without conflict · `code-based` · `critical`

- **WHEN** `auth.test.ts` and `programs.test.ts` run concurrently
- **THEN** both pass because each creates its own unique user via `seedUser()`

#### Scenario: Mutating test does not affect other tests · `code-based` · `critical`

- **GIVEN** `programs.test.ts` deletes a program via `DELETE /api/programs/:id`
- **WHEN** `results.test.ts` runs (possibly in parallel)
- **THEN** `results.test.ts` passes because it uses its own seeded program, not the deleted one

---

### REQ-HARNESS-014: CI Server Lifecycle

The harness **MUST** support two operational modes:

1. **Local development** — the test suite expects a pre-running server at `BASE_URL`. No server management.
2. **CI** — the test suite starts the TS API server before running tests and stops it after. This **SHOULD** follow the pattern established in `apps/web/playwright.config.ts`.

The mode selection **SHOULD** be based on the `CI` environment variable: when `CI` is set, the harness starts the server; otherwise it assumes a pre-running server.

The CI mode **MUST** ensure:

- The API is started with `NODE_ENV=development` (or equivalent) so that `POST /api/auth/dev` is available
- The API has a running PostgreSQL database accessible via `DATABASE_URL`
- The harness waits for the server to be ready (health check at `GET /health`) before running tests

#### Scenario: Local dev uses pre-running server · `code-based` · `standard`

- **GIVEN** `CI` env var is not set and a server is running at `http://localhost:3001`
- **WHEN** `bun run --filter harness test` is executed
- **THEN** tests run against the existing server without starting a new one

#### Scenario: CI starts server before tests · `code-based` · `critical`

- **GIVEN** `CI` env var is set to `"true"`
- **WHEN** the harness test suite starts
- **THEN** the TS API server is launched, health-checked at `GET /health`, and tests proceed only after a 200 response

#### Scenario: CI server runs in development mode · `code-based` · `critical`

- **GIVEN** the harness starts the server in CI mode
- **WHEN** `POST /api/auth/dev` is called
- **THEN** the response is HTTP 200 (not 404), confirming the server is in development mode

---

### REQ-HARNESS-015: Health Endpoint Assertion

The harness **MUST** include a system test that validates the `GET /health` response shape.

The `HealthResponse` schema **MUST** validate:

- `status`: string (expected value `"healthy"`)
- `timestamp`: string matching ISO date regex
- `uptime`: number
- `db`: string
- `redis`: string

#### Scenario: Health endpoint returns valid shape · `code-based` · `critical`

- **WHEN** `GET /health` is called
- **THEN** the response is HTTP 200 and `HealthResponseSchema.safeParse(body).success` is `true`, with `body.status === "healthy"` and `body.timestamp` matching the ISO date regex

---

### REQ-HARNESS-016: Stats Online Endpoint Assertion

The harness **MUST** validate `GET /api/stats/online` returns `{ count: number | null }` where `count` is always-present-possibly-null.

#### Scenario: Stats online returns count key with nullable value · `code-based` · `critical`

- **WHEN** `GET /api/stats/online` is called
- **THEN** `"count" in body` is `true` and `body.count` is either `null` or a non-negative integer

---

## Acceptance Criteria Summary

| Requirement ID  | Type  | Priority | Scenarios |
| --------------- | ----- | -------- | --------- |
| REQ-HARNESS-001 | ADDED | MUST     | 3         |
| REQ-HARNESS-002 | ADDED | MUST     | 5         |
| REQ-HARNESS-003 | ADDED | MUST     | 4         |
| REQ-HARNESS-004 | ADDED | MUST     | 3         |
| REQ-HARNESS-005 | ADDED | MUST     | 3         |
| REQ-HARNESS-006 | ADDED | MUST     | 4         |
| REQ-HARNESS-007 | ADDED | MUST     | 3         |
| REQ-HARNESS-008 | ADDED | MUST     | 2         |
| REQ-HARNESS-009 | ADDED | MUST     | 3         |
| REQ-HARNESS-010 | ADDED | MUST     | 2         |
| REQ-HARNESS-011 | ADDED | MUST     | 3         |
| REQ-HARNESS-012 | ADDED | MUST     | 2         |
| REQ-HARNESS-013 | ADDED | MUST     | 2         |
| REQ-HARNESS-014 | ADDED | MUST     | 3         |
| REQ-HARNESS-015 | ADDED | MUST     | 1         |
| REQ-HARNESS-016 | ADDED | MUST     | 1         |

**Total Requirements**: 16
**Total Scenarios**: 44

---

## Eval Definitions

| Scenario                                                                 | Eval Type  | Criticality | Threshold      |
| ------------------------------------------------------------------------ | ---------- | ----------- | -------------- |
| REQ-HARNESS-001 > Workspace resolves in monorepo install                 | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-001 > Harness has no API internal imports                    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-001 > Monorepo test pipeline includes harness                | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-002 > BASE_URL defaults to localhost:3001                    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-002 > BASE_URL overrides target server                       | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-002 > Cookie jar captures refresh token                      | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-002 > Cookie jar replays cookies on matching path            | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-002 > Cookie jar does not send cookies to non-matching paths | code-based | standard    | pass@3 >= 0.90 |
| REQ-HARNESS-003 > Seed creates unique user per call                      | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-003 > Seed returns valid access token                        | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-003 > Seed populates cookie jar with refresh token           | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-003 > Dev endpoint unavailable in production                 | code-based | standard    | pass@3 >= 0.90 |
| REQ-HARNESS-004 > Strict schema rejects unexpected key                   | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-004 > Strict schema accepts valid TS API response            | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-004 > Schema references contract section in comments         | code-based | standard    | pass@3 >= 0.90 |
| REQ-HARNESS-005 > User object keys are exactly the expected set          | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-005 > Error response keys are exactly error and code         | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-005 > snake_case key detected as failure                     | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-006 > User name field is present with null value             | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-006 > Fresh program has empty collections not null           | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-006 > Result row omits amrapReps when not set                | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-006 > Undo response omits prevRpe and prevAmrapReps          | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-007 > User createdAt has exactly 3 fractional digits         | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-007 > Go RFC3339Nano format is rejected                      | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-007 > Timestamp without fractional seconds is rejected       | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-008 > nextCursor has valid format                            | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-008 > nextCursor is null when no more pages                  | code-based | standard    | pass@3 >= 0.90 |
| REQ-HARNESS-009 > Dev auth sets refresh_token with correct attributes    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-009 > Signout clears refresh_token cookie                    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-009 > Cookie path drift detected                             | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-010 > Catalog list returns exact Cache-Control               | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-010 > Catalog detail returns exact Cache-Control             | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-011 > 401 unauthorized has exact error shape                 | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-011 > 404 not found has exact error shape                    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-011 > Validation error has exact error shape                 | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-012 > Signout returns empty 204                              | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-012 > Program delete returns empty 204                       | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-013 > Two test files run in parallel without conflict        | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-013 > Mutating test does not affect other tests              | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-014 > Local dev uses pre-running server                      | code-based | standard    | pass@3 >= 0.90 |
| REQ-HARNESS-014 > CI starts server before tests                          | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-014 > CI server runs in development mode                     | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-015 > Health endpoint returns valid shape                    | code-based | critical    | pass^3 = 1.00  |
| REQ-HARNESS-016 > Stats online returns count key with nullable value     | code-based | critical    | pass^3 = 1.00  |
