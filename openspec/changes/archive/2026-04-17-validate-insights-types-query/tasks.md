# Tasks — validate insights `types` query

Strict TDD is active. RED tasks must see a failing test before the corresponding GREEN implementation.

## 1. Canonical insight types module

- [x] 1.1 Create `apps/api/src/lib/insight-types.ts` exporting `INSIGHT_TYPES` (readonly tuple of the four known types) and `type InsightType = (typeof INSIGHT_TYPES)[number]`. No validator function yet.
- [x] 1.2 **RED** — create `apps/api/src/lib/insight-types.test.ts` with failing tests for `parseInsightTypesQuery(raw)`:
  - undefined → `ok([])`
  - empty string `''` → `ok([])`
  - `'frequency'` → `ok(['frequency'])`
  - `'volume_trend,frequency'` → `ok(['volume_trend', 'frequency'])`
  - `' frequency '` (whitespace) → `ok(['frequency'])`
  - `'frequency,,volume_trend'` (empty entries) → `ok(['frequency', 'volume_trend'])`
  - `'frequency,frequency'` (duplicates) → `ok(['frequency', 'frequency'])` — deduping is not a validation concern
  - `'bogus'` → `err({ invalidValues: ['bogus'] })`
  - `'frequency,bogus'` → `err({ invalidValues: ['bogus'] })`
  - `'bogus,also-bogus'` → `err({ invalidValues: ['bogus', 'also-bogus'] })` — order preserved
- [x] 1.3 **GREEN** — implement `parseInsightTypesQuery` in `apps/api/src/lib/insight-types.ts` using the existing `Result` primitive from `apps/api/src/lib/result.ts`. All tests in 1.2 pass. Explicit return type per project rules.
- [x] 1.4 Confirm no `any`, no type assertions, no `console.log`, nesting depth ≤ 3.

## 2. `ApiError` details extension

- [x] 2.1 **RED** — add tests (or extend an existing test file) covering: `new ApiError(400, 'msg', 'CODE', { details: { foo: 'bar' } })` exposes `.details` as a readonly record, and the `onError` handler returns `{ error: 'msg', code: 'CODE', foo: 'bar' }` when the error has `details`, and `{ error: 'msg', code: 'CODE' }` when it does not. Prefer extending the existing error-handler test surface; if none exists, add a focused unit test for `ApiError` and a small integration assertion through a test Elysia app.
- [x] 2.2 **GREEN (part a)** — extend `apps/api/src/middleware/error-handler.ts`: add `readonly details?: Readonly<Record<string, unknown>>;` to `ApiError`; extend constructor options to accept `details`; assign on construction.
- [x] 2.3 **GREEN (part b)** — update the `onError` handler in `apps/api/src/create-app.ts:74` so the `ApiError` branch returns `{ error: error.message, code: error.code, ...(error.details ?? {}) }`.
- [x] 2.4 Confirm no other `ApiError` throwers in the codebase produce unexpected fields: grep `throw new ApiError` and verify all existing call sites omit `details` (so their responses are unchanged). Record the grep command in the verify phase.

## 3. Route integration — wire validation into `GET /insights`

- [x] 3.1 **RED** — create `apps/api/src/routes/insights.test.ts` with failing route-level tests wrapping `insightsRoutes` in a test Elysia app (with the global `onError` handler from `create-app.ts`). Mock `getInsights` per the apps/api test pattern (mocks before imports). Cover the six spec scenarios:
  - known types → 200, filtered rows
  - no `types` param → 200, all rows (service called with `[]`)
  - `types=` empty → 200, equivalent to omitted
  - `types=bogus` → 400, body has `code: 'INVALID_INSIGHT_TYPE'`, `invalidValues: ['bogus']`, `validValues: [... the four]`; `getInsights` never called
  - `types=frequency,bogus` → 400, same shape; `getInsights` never called
  - `types= frequency ` (whitespace) → 200, filtered rows for frequency
- [x] 3.2 **GREEN** — modify `apps/api/src/routes/insights.ts`:
  - import `INSIGHT_TYPES` and `parseInsightTypesQuery` from `../lib/insight-types`
  - call `parseInsightTypesQuery(query.types)` **before** `rateLimit(...)` (per D4)
  - on `err` → `throw new ApiError(400, 'Invalid insight type', 'INVALID_INSIGHT_TYPE', { details: { invalidValues: result.error.invalidValues, validValues: INSIGHT_TYPES } })`
  - on `ok` → call `rateLimit(...)` then `getInsights(userId, result.value)` using the typed list
  - remove the in-handler comma-split block (lines 20–26 of current file)
- [x] 3.3 All six scenarios from 3.1 pass.

## 4. Test suite wiring

- [x] 4.1 ~~Add `apps/api/src/lib/insight-types.test.ts` to the ordered `test` script in `apps/api/package.json`.~~ **Not needed** — the `test` script globs `src/lib` as a directory; new files are auto-included.
- [x] 4.2 ~~Add `apps/api/src/routes/insights.test.ts` to the ordered `test` script in `apps/api/package.json`.~~ **Not needed** — the `test` script globs `src/routes` as a directory; new files are auto-included.
- [x] 4.3 Run `cd apps/api && bun run test` — full ordered suite passes.

## 5. Verification gates

- [x] 5.1 `cd apps/api && bun run typecheck` — no errors.
- [x] 5.2 Root `bun run lint` (web) — clean. `cd apps/api && bun run lint` — 1 pre-existing error in `bootstrap.ts:150` (commit `009f4d85`, 2026-04-13) unrelated to this change; all files touched by this change are clean.
- [x] 5.3 Root `bun run format:check` — clean.
- [x] 5.4 Manual smoke (optional): **skipped**. Integration tests in §3 exercise the Elysia app end-to-end (JWT, route, error handler) — equivalent coverage without spinning up Postgres/Redis.
