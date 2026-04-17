# Design — validate insights `types` query

## Context

`GET /insights` accepts a comma-separated `types` query string and forwards the parsed list into a Drizzle `inArray` filter on `user_insights.insight_type`. Unknown strings flow through silently. The spec requires validation against a closed set, a `400` on any unknown value, and a machine-readable error that names the offending value and the valid set.

The endpoint is authenticated (`jwtPlugin` + `resolveUserId`), rate-limited at 30 req/min, and returns `{ data: [...] }`. The shape of `data` does not change.

## Decisions

### D1 — The canonical list of insight types lives at `apps/api/src/lib/insight-types.ts`

A new api-local module exports:

```ts
export const INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'plateau_detection',
  'load_recommendation',
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];
```

**Considered and rejected**: placing it in `@gzclp/shared/catalog/insight-types` to deduplicate the two hardcoded lists in `apps/web/src/features/profile/profile-page.tsx:37-42` and `apps/web/src/features/home/home-page.tsx:18`.

**Why api-local wins here**: the proposal scopes this change to the API. Introducing a shared export and rewiring the two web files expands the blast radius and the diff. Keeping the list api-local now leaves the shared refactor as a clean follow-up change — `sdd-new dedupe-insight-types-catalog` — with its own proposal.

The Python `apps/analytics` service is authoritative for what types _get produced_. This TS list is the validation contract for what the API _accepts from clients_. They are allowed to diverge: analytics can introduce a new type only after the TS list is updated, exactly the intended control point.

### D2 — Validation is a pure helper invoked inside the handler

`apps/api/src/lib/insight-types.ts` also exports:

```ts
export function parseInsightTypesQuery(
  raw: string | undefined
): Result<readonly InsightType[], { invalidValues: readonly string[] }>;
```

Using the existing `Result<T, E>` primitive from `apps/api/src/lib/result.ts` — the API codebase already uses it for handler-decided HTTP mappings.

Behavior:

- `undefined` or `''` → `ok([])` (no filter).
- Comma-split, `.map(s => s.trim()).filter(Boolean)`. All trimmed non-empty entries are validated.
- If every entry is a known `InsightType` → `ok(validatedArray)`.
- Otherwise → `err({ invalidValues: [...unknown values in input order] })`.

Rejected alternatives:

- **Elysia `t.Union` of literals in the route schema.** Elysia validates a single string; it cannot express "comma-separated list of literals".
- **Zod on top of the string.** The api already uses `Result` for this error-boundary-is-the-route pattern; adding Zod here is an unnecessary second style.
- **Validating inside `getInsights` service.** The service stays framework-agnostic; query-string parsing belongs at the route boundary.

### D3 — Error payload extends `ApiError` with an optional `details` field

Current `ApiError` carries only `statusCode`, `message`, `code`, and optional headers. The global handler in `create-app.ts:74` returns `{ error: message, code }`. The spec requires the response to carry `invalidValues` and `validValues` in a machine-readable form.

Change:

1. `apps/api/src/middleware/error-handler.ts`:
   - Add `readonly details?: Readonly<Record<string, unknown>>`.
   - Extend constructor options to accept `details`.
2. `apps/api/src/create-app.ts` (the `onError` handler at line 64-75):
   - Return `{ error: error.message, code: error.code, ...(error.details ?? {}) }`.

The insights route throws:

```ts
throw new ApiError(400, 'Invalid insight type', 'INVALID_INSIGHT_TYPE', {
  details: { invalidValues, validValues: INSIGHT_TYPES },
});
```

Producing the response body:

```json
{
  "error": "Invalid insight type",
  "code": "INVALID_INSIGHT_TYPE",
  "invalidValues": ["bogus"],
  "validValues": ["volume_trend", "frequency", "plateau_detection", "load_recommendation"]
}
```

Rejected alternatives:

- **Hardcode invalid/valid into `message`.** Fails the spec's machine-readable requirement.
- **Bypass `ApiError` and `set.status = 400` directly.** Duplicates logging, Sentry, and latency-bookkeeping that `onError` already centralizes.
- **Nest under a `details` key in the response body.** Flat is fine here and matches the `{ error, code, … }` shape clients already parse. `details` sits on the class, not the wire.

`details` on `ApiError` is a general extension, not a one-off. Future 400s (e.g. validation errors from other routes) can use the same channel.

### D4 — Validation fires before the rate-limit call

The existing handler at `apps/api/src/routes/insights.ts:17` runs `rateLimit` first, then parses `types`. We reverse that: validate first, rate-limit second.

**Why**: a client spamming bogus types would otherwise eat rate-limit budget before being told their request is malformed. Validation is cheap and deterministic; rejecting early protects the limiter. No observable change for valid clients.

### D5 — Two test files, at two layers

- `apps/api/src/lib/insight-types.test.ts` — unit tests for `parseInsightTypesQuery` covering: undefined, empty string, single valid, multiple valid, whitespace, single invalid, mixed valid/invalid, duplicates.
- `apps/api/src/routes/insights.test.ts` — route-level integration tests wrapping the route in a test Elysia app (per the pattern in `apps/web/CLAUDE.md`'s API section and existing route tests in the codebase). Mocks `getInsights` service. Covers all six scenarios from the spec.

Both files must be registered in the ordered test suite at `apps/api/package.json` to run under `bun run test`.

## File change summary

- **CREATE** `apps/api/src/lib/insight-types.ts` — list + type + `parseInsightTypesQuery`
- **CREATE** `apps/api/src/lib/insight-types.test.ts` — unit tests
- **MODIFY** `apps/api/src/middleware/error-handler.ts` — add `details` to `ApiError`
- **MODIFY** `apps/api/src/create-app.ts` — spread `details` in `onError` response
- **MODIFY** `apps/api/src/routes/insights.ts` — call validator, reorder before rate-limit
- **CREATE** `apps/api/src/routes/insights.test.ts` — integration tests for all spec scenarios
- **MODIFY** `apps/api/package.json` — add new test files to the ordered `test` script

## Non-goals

- No change to `apps/analytics` producer code.
- No change to web consumers (`profile-page.tsx`, `home-page.tsx`) — they send only valid types.
- No OpenAPI/Swagger doc update beyond what Elysia emits; the `detail.responses` block can be extended in a follow-up if needed.
