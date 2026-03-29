---
summary: Add apps/harness Bun workspace with schema-based HTTP contract tests that run against TS or Go by swapping BASE_URL.
read_when: Starting spec/design work for the parity harness, or evaluating migration slice test coverage.
---

# Proposal: go-api-parity-harness

## Intent

The TS API has no test layer that fires real HTTP requests and asserts full response shapes. Without one, serialization differences between the TS and Go implementations — camelCase vs snake_case keys, null-vs-omitted fields, ISO date precision, cookie attributes — will only surface in production. This harness closes that gap by building a black-box HTTP contract test suite that runs identical assertions against either server by changing a single env var.

## Scope

**In scope:**

- New `apps/harness/` Bun workspace — purely HTTP, imports no TS API internals
- Zod response schemas for all ~33 endpoint patterns across 7 route groups
- Explicit key enumeration assertions to catch camelCase drift
- Semantic assertions per contract §9 and §17: null-vs-omit, ISO `.000Z` date regex, cursor format, cookie attributes (`path=/api/auth`, `httpOnly`, `sameSite=Strict`), `Cache-Control` exact string, empty-body 204s, error shape `{ error, code }` only
- User/program seeding via `POST /api/auth/dev` + `POST /api/programs` (same pattern as Playwright E2E helpers)
- `BASE_URL` env var switching — TS default `http://localhost:3001`, Go via `GO_API_URL`
- Pre-running server for local dev; self-starting (webServer block) for CI
- Workspace wired into monorepo `bun run test` pipeline

**Out of scope (deferred):**

- Golden-file snapshot capture — schema-based assertions are sufficient for Lote 1
- `POST /api/auth/google` — requires live Google credentials; `/auth/dev` covers all user creation
- Rate limit sliding-window tests — fragile in CI; separate slice
- `GET /metrics` Prometheus text assertions — deferred until Go Prometheus integration exists
- `POST /api/catalog/preview` full coverage — complex JSONB payload; deferred to catalog slice
- Redis internal state assertions (singleflight, cache invalidation timing)

## Approach

1. **Workspace layout:** `apps/harness/` with `package.json` (bun workspace), `src/helpers/` (client wrapper, cookie jar, seeding), `src/schemas/` (Zod response schemas per route group), `src/tests/` (one file per route group).

2. **HTTP client:** native `fetch` — zero deps. Manual `Set-Cookie` parsing (~20 lines) for cookie jar. No `undici` or Playwright required.

3. **Test runner:** `bun:test`. Each test file seeds its own isolated user via `POST /api/auth/dev` (which calls `crypto.randomUUID()` in the email) — no serialization needed, parallel-safe.

4. **Schema strategy:** Zod schemas with `.strict()` to reject unexpected keys. Supplement with explicit `Object.keys(body).sort()` assertions on high-risk shapes (User, ProgramInstanceResponse, result rows). Date fields asserted with `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/` regex. Cursor fields validated by splitting at `lastIndexOf('_')`.

5. **Server lifecycle:** `reuseExistingServer: !process.env.CI` pattern copied from `apps/web/playwright.config.ts`. CI starts the server; local dev expects it pre-running.

6. **Priority order for implementation:** auth → programs → results → catalog → exercises → program-definitions → system. Auth first because all other tests depend on its seeding helpers.

## Risks

- **False green on schema gaps:** Zod `.strict()` catches extra keys but will not catch a key present with the wrong type if the schema is too loose. Mitigate: combine schema validation with explicit key enumeration on every top-level response object.
- **Dev endpoint availability in CI:** `POST /api/auth/dev` returns 404 in production mode. CI must run the API with `NODE_ENV=development` or equivalent. The Playwright E2E tests already have this requirement — the harness inherits it.
- **Test database isolation:** mutating tests (POST/PATCH/DELETE) that share a DB instance can leave dirty state. Mitigate: each test creates its own user and program via seeding; deletions are scoped to those IDs. No shared fixtures.
- **Schema drift from contract:** Zod schemas are manually authored from `http-contract.md`. If the contract is updated without updating schemas, tests go stale. Mitigate: schemas live in `apps/harness/src/schemas/` alongside a comment citing the contract section — visible in review.
- **Cookie jar edge cases:** manual `Set-Cookie` parsing may miss `SameSite` casing variants or multiple cookies on one response. Mitigate: test against the actual TS API in CI from day one; any parser bug surfaces immediately.

## Rollback Plan

The harness is additive — a new workspace with no modifications to existing code. Rollback is `trash apps/harness/` and removing the workspace entry from the root `package.json`. No migrations, no schema changes, no impact on existing tests.
