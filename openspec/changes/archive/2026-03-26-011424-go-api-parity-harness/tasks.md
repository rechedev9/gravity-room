---
summary: Apply report for Phase 1 + Phase 2 + Phase 3 of go-api-parity-harness.
read_when: Reviewing implementation progress of the harness workspace.
---

# Apply Report: go-api-parity-harness (Phase 1 + 2 + 3)

**Date**: 2026-03-26

## Phase 1: Workspace Scaffolding

- [x] **1.1** `apps/harness/package.json` — workspace name `harness`, private, test + typecheck scripts, zod dep, @types/bun + typescript devDeps
- [x] **1.2** `apps/harness/tsconfig.json` — ESNext target, bundler moduleResolution, strict + noUncheckedIndexedAccess, `@types/bun` types
- [x] **1.3** `apps/harness/bunfig.toml` — `[test]` section with `preload = ["./src/preload.ts"]`

## Phase 2: Primitive Helpers

- [x] **2.1** `apps/harness/src/helpers/cookie-jar.ts` — Cookie interface, CookieJar class with captureFromResponse, getCookieHeader (path-prefix matching, maxAge=0 exclusion), getCookie, clear
- [x] **2.2** `apps/harness/src/preload.ts` — polls BASE_URL/health every 500ms up to 30s, throws on timeout, zero internal imports

## Phase 3: Schemas, Client, Assertions, Seed

- [x] **3.1** `apps/harness/src/schemas/error.ts` — ErrorResponseSchema (strict)
- [x] **3.2** `apps/harness/src/helpers/client.ts` — BASE_URL, HarnessClient interface, createClient() factory; URL resolution, Bearer injection, cookie jar integration, Content-Type for POST/PATCH/PUT
- [x] **3.3** `apps/harness/src/helpers/assertions.ts` — ISO_DATE_REGEX, UUID_V4_REGEX, expectISODate, expectUUID, expectKeys, expectCursor, expectErrorShape, expectEmpty204
- [x] **3.4** `apps/harness/src/schemas/auth.ts` — UserResponseSchema, AuthResponseSchema, RefreshResponseSchema
- [x] **3.5** `apps/harness/src/schemas/programs.ts` — ResultEntrySchema, ResultsMapSchema, UndoEntrySchema, ProgramInstanceResponseSchema, ProgramListResponseSchema, ExportResponseSchema, ImportResponseSchema
- [x] **3.6** `apps/harness/src/schemas/results.ts` — re-exports ProgramInstanceResponseSchema as ResultResponseSchema, UndoResponseSchema
- [x] **3.7** `apps/harness/src/schemas/catalog.ts` — CatalogEntrySchema, CatalogListResponseSchema, CatalogDetailResponseSchema
- [x] **3.8** `apps/harness/src/schemas/exercises.ts` — ExerciseEntrySchema, ExerciseListResponseSchema, MuscleGroupsResponseSchema, CreateExerciseResponseSchema
- [x] **3.9** `apps/harness/src/schemas/program-definitions.ts` — ProgramDefinitionResponseSchema, ProgramDefinitionListResponseSchema
- [x] **3.10** `apps/harness/src/schemas/system.ts` — HealthResponseSchema (with typed db/redis sub-objects), StatsOnlineResponseSchema
- [x] **3.11** `apps/harness/src/helpers/seed.ts` — SeededUser interface, seedUser(), createTestProgram(), seedResult(), DEFAULT_WEIGHTS

## Deviations from Design

1. **tsconfig `types` field** (Phase 1): Design specified `"bun-types"` but the monorepo uses `@types/bun` (different package). Changed to `"@types/bun"` to match what's installed.
2. **preload.ts `export {}`** (Phase 2): Added empty export to satisfy TypeScript module detection for top-level `await`. No behavioral change.
3. **UserResponseSchema** (Phase 3): Design included `createdAt`/`updatedAt` fields. Actual API (`routes/auth.ts` `userResponse()`) returns only `{id, email, name, avatarUrl}` with no timestamps. Contract confirms same. Schema matches actual API.
4. **CatalogEntrySchema** (Phase 3): Design had `{id, name, description, author, tags}`. Actual API (`services/catalog.ts` `CatalogEntry`) returns `{id, name, description, author, category, level, source, totalWorkouts, workoutsPerWeek, cycleLength}`. Schema matches actual API.
5. **CatalogDetailResponseSchema** (Phase 3): Design had a strict object with `{id, name, description, author, tags, definition}`. Actual API returns a raw hydrated `ProgramDefinition` (opaque object from `hydrateProgramDefinition()`). Schema uses `z.unknown()`.
6. **ExerciseEntrySchema** (Phase 3): Design had `{id, name, slug, primaryMuscles, secondaryMuscles, equipment, force, level, mechanic, category, createdBy}`. Actual API (`services/exercises.ts` `ExerciseEntry`) returns `{id, name, muscleGroupId, equipment, isCompound, isPreset, createdBy, force, level, mechanic, category, secondaryMuscles}`. No `slug`, no `primaryMuscles`; has `muscleGroupId`, `isCompound`, `isPreset`. Schema matches actual API.
7. **ExerciseListResponseSchema** (Phase 3): Design had `{exercises, total, offset, limit}`. Actual API returns `{data, total, offset, limit}`. Schema matches actual API.
8. **MuscleGroupsResponseSchema** (Phase 3): Design had `z.array(z.string())`. Actual API returns `[{id, name}]`. Schema matches actual API.
9. **ProgramDefinitionResponseSchema** (Phase 3): Design had `{id, name, description, definition, isPublic, createdBy, deletedAt, createdAt, updatedAt}`. Actual API (`services/program-definitions.ts` `toResponse()`) returns `{id, userId, definition, status, createdAt, updatedAt, deletedAt}`. Schema matches actual API.
10. **ProgramDefinitionListResponseSchema** (Phase 3): Design had bare array. Actual API returns `{data, total}`. Schema matches actual API.
11. **HealthResponseSchema** (Phase 3): Design had `db: z.string()` and `redis: z.string()`. Actual API (`create-app.ts`) returns `db` and `redis` as typed objects (`{status, latencyMs?}` or `{status, error?}` or `{status: 'disabled'}`). Schema uses discriminated unions matching actual API.

## Verification

- `bun install` — workspace detected, lockfile updated
- `bun run --filter harness typecheck` — passes with exit code 0

---

# Phase 4: Test Files

**Date**: 2026-03-26
**Status**: complete

## Files Created

| Task      | File                                                 | Tests            |
| --------- | ---------------------------------------------------- | ---------------- |
| 4.1       | `apps/harness/src/tests/system.test.ts`              | 4                |
| 4.2       | `apps/harness/src/tests/auth.test.ts`                | 9                |
| 4.3       | `apps/harness/src/tests/programs.test.ts`            | 9                |
| 4.4       | `apps/harness/src/tests/results.test.ts`             | 7                |
| 4.5       | `apps/harness/src/tests/catalog.test.ts`             | 5                |
| 4.6       | `apps/harness/src/tests/exercises.test.ts`           | 4                |
| 4.7       | `apps/harness/src/tests/program-definitions.test.ts` | 5                |
| **Total** | **7 files**                                          | **43 scenarios** |

## Phase 4 Verification

- `bun run --filter harness typecheck` — exits 0, zero errors

## Grounding Deviations (Test-Level)

Tests were written against the **real API source**, not the design doc schemas. Key findings:

### 1. `POST /api/programs/:id/results` returns result entry, not ProgramInstanceResponse

The route handler (results.ts:37-44) returns `{workoutIndex, slotId, result, amrapReps?, rpe?, setLogs?}` with status 201. The `ResultResponseSchema` (re-export of `ProgramInstanceResponseSchema`) does not match. Tests validate the actual response shape directly instead of using `ResultResponseSchema`.

### 2. `POST /api/programs/:id/undo` returns `{undone: {...} | null}` wrapper

The route handler (results.ts:131-143) wraps the undo entry in `{undone: ...}`. The `UndoResponseSchema` defines the inner entry shape. Tests validate the wrapper and parse the inner object with `UndoResponseSchema`.

### 3. Undo entry omits `prevRpe` and `prevAmrapReps` in route handler

The route handler only spreads `prev` and `prevSetLogs` — never `prevRpe` or `prevAmrapReps`. Tests assert these keys are absent.

### 4. `POST /api/auth/dev` returns status 201, not 200

Verified against auth.ts line 166: `set.status = 201`. Tests assert 201.

### 5. `GET /api/catalog/:programId` Cache-Control differs from list

List: `public, max-age=300, stale-while-revalidate=60`. Detail: `public, max-age=300` (no stale-while-revalidate). Tests assert the exact header per endpoint.

### 6. `GET /api/muscle-groups` at `/api/muscle-groups`, not `/api/exercises/muscle-groups`

The exerciseRoutes Elysia mounts `/muscle-groups` directly under the `/api` prefix.

## Schema Issues to Surface at Runtime

1. **`ProgramListResponseSchema`**: Key is `programs` but actual API returns `data`. List items are `ProgramInstanceListItem` (6 fields: id, programId, name, status, createdAt, updatedAt), not the full `ProgramInstanceResponseSchema`. This will cause `safeParse` to fail at runtime.
2. **`ResultResponseSchema`**: Re-exports `ProgramInstanceResponseSchema` but POST results returns a result entry shape. Not used in tests (tests validate actual shape directly).
