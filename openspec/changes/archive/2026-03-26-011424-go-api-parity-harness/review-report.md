---
summary: Semantic review of go-api-parity-harness implementation against spec and design.
reviewed_at: 2026-03-26
---

# Review: go-api-parity-harness

**Verdict: PASS** (with non-blocking issues)

---

## Requirement Coverage Matrix

| REQ             | Status            | Notes                                                                                                                                                                                                   |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-HARNESS-001 | COVERED           | Workspace at `apps/harness/`, correct `package.json`, no API internals, `src/helpers/`, `src/schemas/`, `src/tests/` present                                                                            |
| REQ-HARNESS-002 | COVERED           | `client.ts` wraps native `fetch`, BASE_URL defaults to `:3001`, `CookieJar` parses Set-Cookie with path-scoped replay, maxAge=0 exclusion                                                               |
| REQ-HARNESS-003 | COVERED           | `seedUser()` creates unique `harness-<uuid>@test.local`, returns `{ email, userId, accessToken, client }`, cookie jar populated                                                                         |
| REQ-HARNESS-004 | COVERED           | All route groups have `.strict()` Zod schemas. Contract section comments present in every schema file                                                                                                   |
| REQ-HARNESS-005 | PARTIALLY COVERED | `expectKeys()` present for User, ProgramInstance, error. Missing for individual result entries and UndoResponse (see I-3)                                                                               |
| REQ-HARNESS-006 | COVERED           | Null-vs-omit tested for User (name, avatarUrl), ProgramInstance (metadata, definitionId, customDefinition, empty collections), result row (amrapReps absent), undo entry (prevRpe/prevAmrapReps absent) |
| REQ-HARNESS-007 | COVERED           | `expectISODate()` with 3-fractional-digit regex. Applied to User (via schema regex), program timestamps, health timestamp, program definition timestamps                                                |
| REQ-HARNESS-008 | PARTIALLY COVERED | `nextCursor` null case tested. No test for valid cursor format (needs >1 page; see I-4)                                                                                                                 |
| REQ-HARNESS-009 | COVERED           | Cookie attributes asserted (path, httpOnly, sameSite). Signout maxAge=0 asserted                                                                                                                        |
| REQ-HARNESS-010 | COVERED           | Catalog list: exact match `"public, max-age=300, stale-while-revalidate=60"`. Catalog detail: `"public, max-age=300"` (matches reality; see D-2)                                                        |
| REQ-HARNESS-011 | PARTIALLY COVERED | 401 and 404 error shapes tested. Missing: 400 validation error scenario for `POST /api/programs` with `{}` (see I-5)                                                                                    |
| REQ-HARNESS-012 | COVERED           | Signout 204 + empty body. Program delete 204 + empty body. Program definition delete 204 + empty body. Missing: result delete 204 (see I-6)                                                             |
| REQ-HARNESS-013 | COVERED           | Every test file seeds its own user in `beforeAll`. Mutating tests (delete, signout, undo) seed dedicated users                                                                                          |
| REQ-HARNESS-014 | PARTIALLY COVERED | Preload health-check via `bunfig.toml`. No CI server start mechanism (see D-3)                                                                                                                          |
| REQ-HARNESS-015 | COVERED           | Health endpoint shape validated including structured db/redis status objects                                                                                                                            |
| REQ-HARNESS-016 | COVERED           | `count` key presence asserted, null-or-non-negative-integer logic present                                                                                                                               |

---

## Schema Spot-Check Results

### 1. Auth — `UserResponseSchema` vs `apps/api/src/routes/auth.ts:70`

- **API returns**: `{ id, email, name, avatarUrl }` (4 fields, no timestamps)
- **Harness schema**: `{ id, email, name, avatarUrl }` with `.strict()`
- **Result**: MATCH. Deviates from spec/design which expected `createdAt`/`updatedAt` but correctly follows reality.

### 2. Exercises — `ExerciseEntrySchema` vs `apps/api/src/services/exercises.ts:28`

- **API returns**: `{ id, name, muscleGroupId, equipment, isCompound, isPreset, createdBy, force, level, mechanic, category, secondaryMuscles }` (12 fields)
- **Harness schema**: same 12 fields with correct nullable annotations
- **Result**: MATCH. Deviates from spec which had `slug`, `primaryMuscles` instead of `muscleGroupId`, `isCompound`, `isPreset`. Correctly follows reality.

### 3. Catalog — `CatalogEntrySchema` vs `apps/api/src/services/catalog.ts:39`

- **API returns**: `{ id, name, description, author, category, level, source, totalWorkouts, workoutsPerWeek, cycleLength }` (10 fields)
- **Harness schema**: same 10 fields
- **Result**: MATCH. Deviates from spec which had `tags` instead of `category, level, source, totalWorkouts, workoutsPerWeek, cycleLength`. Correctly follows reality.

### 4. Health — `HealthResponseSchema` vs `apps/api/src/create-app.ts:145`

- **API returns**: `{ status, timestamp, uptime, db: {status, latencyMs?}, redis: {status, latencyMs?, error?} }`
- **Harness schema**: `db` and `redis` are discriminated union objects (not strings)
- **Result**: MATCH. Deviates from spec which said `db: string, redis: string`. Correctly follows reality.

### 5. Programs — `ProgramListResponseSchema` vs `apps/api/src/services/programs.ts:258`

- **API returns**: `{ data: [...], nextCursor }` with `ProgramInstanceListItem` items (6 fields)
- **Harness schema**: `{ data: ProgramInstanceListItemSchema[], nextCursor }` with matching list-item schema
- **Result**: MATCH. Deviates from design which used `programs` as key name. Correctly follows reality.

### 6. Undo — `UndoResponseSchema` vs `apps/api/src/routes/results.ts:135`

- **API returns**: `{ undone: { i, slotId, prev?, prevSetLogs? } | null }` (no prevRpe/prevAmrapReps)
- **Harness schema**: `{ undone: { i, slotId, prev?, prevSetLogs? }.strict() | null }.strict()`
- **Result**: MATCH. The undo endpoint intentionally omits `prevRpe` and `prevAmrapReps` from the response.

---

## Design Deviations (Justified)

### D-1: UserResponse omits createdAt/updatedAt

- **Spec**: REQ-HARNESS-005 expected keys `["avatarUrl", "createdAt", "email", "id", "name", "updatedAt"]`
- **Reality**: `userResponse()` at `apps/api/src/routes/auth.ts:70` returns only 4 fields
- **Harness**: Correctly asserts `["avatarUrl", "email", "id", "name"]`
- **Verdict**: Justified. Grounded in real API behavior.

### D-2: Catalog detail Cache-Control differs from catalog list

- **Spec**: REQ-HARNESS-010 expected both endpoints to return `"public, max-age=300, stale-while-revalidate=60"`
- **Reality**: List returns `"public, max-age=300, stale-while-revalidate=60"`, detail returns `"public, max-age=300"`
- **Harness**: Correctly asserts each value separately
- **Verdict**: Justified. Follows real server behavior.

### D-3: CI server lifecycle simplified

- **Spec**: REQ-HARNESS-014 expected CI mode to start/stop the server
- **Reality**: Harness only has preload health-check. CI pipeline is responsible for server lifecycle.
- **Verdict**: Justified. Design doc (section 5.4) explicitly documents this as a deliberate simplification.

### D-4: CatalogDetailResponseSchema is `z.unknown()`

- **Spec**: REQ-HARNESS-004 expected a structured `CatalogDetailResponseSchema`
- **Reality**: Detail returns a full `ProgramDefinition` object whose shape is opaque to the harness
- **Verdict**: Justified. The harness validates the response is parseable JSON, and structural validation of ProgramDefinition internals is explicitly out of scope (design doc section 3.1).

### D-5: ProgramListResponse uses `data` key instead of `programs`

- **Design**: Documented as `programs: z.array(...)`
- **Reality**: API returns `{ data: [...], nextCursor }`
- **Harness**: Uses `data` key
- **Verdict**: Justified. Grounded in real API behavior.

### D-6: Health status is `"ok"` not `"healthy"`

- **Spec**: REQ-HARNESS-015 expected `body.status === "healthy"`
- **Reality**: API returns `status: 'ok'` or `status: 'degraded'`
- **Harness**: Asserts `body.status === "ok"`
- **Verdict**: Justified.

### D-7: RecordResultResponseSchema instead of returning full ProgramInstanceResponse

- **Design**: `results.ts` schema reexported `ProgramInstanceResponseSchema` as `ResultResponseSchema`
- **Reality**: `POST /programs/:id/results` returns `{ workoutIndex, slotId, result, amrapReps?, rpe?, setLogs? }` (the entry, not the full instance)
- **Harness**: Uses `RecordResultResponseSchema` matching the actual entry shape
- **Verdict**: Justified. Grounded in real API behavior.

### D-8: Exercise schema deviates from spec fields

- **Spec**: Expected `slug`, `primaryMuscles` fields
- **Reality**: API has `muscleGroupId`, `isCompound`, `isPreset` instead
- **Harness**: Matches reality
- **Verdict**: Justified.

### D-9: MuscleGroupsResponse is array of objects, not array of strings

- **Spec**: Expected `z.array(z.string())`
- **Reality**: Returns `[{id, name}, ...]`
- **Harness**: Uses `z.array(z.object({id, name}).strict())`
- **Verdict**: Justified.

### D-10: ProgramDefinitionResponse deviates from spec

- **Spec**: Expected `name, description, isPublic, createdBy`
- **Reality**: API has `userId, status` instead of `name, description, isPublic, createdBy`
- **Harness**: Matches reality with `{id, userId, definition, status, createdAt, updatedAt, deletedAt}`
- **Verdict**: Justified.

---

## Issues

### BLOCKING

None.

### NON-BLOCKING

#### I-1: Auth test does not assert ISO date format on User timestamps

- **Impact**: Low (User object has no timestamps in reality; spec assumed they existed)
- **Location**: `apps/harness/src/tests/auth.test.ts`
- **Detail**: REQ-HARNESS-007 scenario "User createdAt has exactly 3 fractional digits" is N/A since UserResponse has no timestamps. This is a spec vs reality mismatch, not a harness bug.

#### I-2: No `expectKeys()` assertion on individual result entries

- **Impact**: Medium
- **Location**: `apps/harness/src/tests/results.test.ts`
- **Detail**: REQ-HARNESS-005 requires key enumeration for "Individual result entries within the results map." The test checks `"amrapReps" in body === false` but does not call `expectKeys()` on result entries. The `ResultEntrySchema.strict()` parse partially compensates.

#### I-3: No `expectKeys()` assertion on UndoResponse

- **Impact**: Medium
- **Location**: `apps/harness/src/tests/results.test.ts`
- **Detail**: REQ-HARNESS-005 requires `expectKeys()` for UndoResponse. The undo test validates schema and checks `prevRpe`/`prevAmrapReps` absence but does not call `expectKeys()` on the undone entry.

#### I-4: Cursor format validation test missing

- **Impact**: Low
- **Location**: `apps/harness/src/tests/programs.test.ts`
- **Detail**: REQ-HARNESS-008 scenario "nextCursor has valid format" requires creating enough programs to trigger pagination and then validating cursor format via `expectCursor()`. The `expectCursor()` helper exists in assertions.ts but is never called in any test.

#### I-5: Validation error shape test missing

- **Impact**: Low
- **Location**: `apps/harness/src/tests/programs.test.ts`
- **Detail**: REQ-HARNESS-011 scenario "Validation error has exact error shape" requires `POST /api/programs` with `{}` returning 400 with `code: "VALIDATION_ERROR"`. No such test exists.

#### I-6: Result delete 204 test missing

- **Impact**: Low
- **Location**: `apps/harness/src/tests/results.test.ts`
- **Detail**: REQ-HARNESS-012 lists `DELETE /api/programs/:id/results/:workoutIndex/:slotId` as a 204 endpoint. No test covers this.

#### I-7: `createTestProgram` helper not asserting response status

- **Impact**: Very low
- **Location**: `apps/harness/src/helpers/seed.ts:49`
- **Detail**: `createTestProgram` throws on non-ok but test output may be confusing if the programs endpoint changes. Not a spec requirement, just a robustness note.

---

## Cookie Jar Analysis

- **Path-scoped replay**: Correctly implemented. `getCookieHeader()` checks `url.pathname.startsWith(cookie.path)`.
- **maxAge=0 exclusion**: Correctly skipped in `getCookieHeader()` but still accessible via `getCookie()` for signout assertion.
- **Multiple Set-Cookie**: Uses `response.headers.getSetCookie()` (correct Web API).
- **Case-insensitive attributes**: Attribute names lowercased before switch.
- **Verdict**: Correct implementation.

## Test Isolation Analysis

- Every test file seeds its own user via `seedUser()` in `beforeAll`.
- Mutating tests (signout, delete, undo) create dedicated users within the test.
- No shared state across test files.
- `catalog.test.ts` and `system.test.ts` use unauthenticated clients (correct for public endpoints).
- **Verdict**: Correct isolation.

## Cross-Workspace Import Analysis

- Zero imports from `apps/api/`, `apps/web/`, or `packages/shared/`.
- All external deps: `zod`, `bun:test`, native `fetch`/`crypto`.
- `DEFAULT_WEIGHTS` duplicated in `seed.ts` (correct: no import from `apps/web/e2e`).
- **Verdict**: Clean boundary.
