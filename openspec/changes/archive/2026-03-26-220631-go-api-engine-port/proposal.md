---
summary: Port the TS progression engine to Go as internal/engine and wire POST /catalog/preview in the Go API.
read_when: Starting spec or design work for go-api-engine-port, or reviewing implementation scope for the engine/preview slice.
---

# Proposal: go-api-engine-port

## Intent

`POST /catalog/preview` is the only auth-required catalog endpoint. In the Go API it currently returns 404 — the route is not registered and `internal/engine/` does not exist. The TypeScript implementation relies on `computeGenericProgram` from `packages/shared/src/generic-engine.ts`, a pure-function deterministic replay engine with no DB dependencies. Porting it to Go unblocks the endpoint and is a prerequisite for any future Go-native program computation (stats, graduation, the full program-instance compute path).

Doing this now is the natural next step after the parity harness landed: the harness explicitly deferred `/catalog/preview` coverage, and the engine port is the only blocked endpoint in the current Go API contract.

## Scope

**In scope:**

- New package `apps/go-api/internal/engine/` with:
  - `types.go` — Go struct equivalents of `ProgramDefinition`, `ExerciseSlot`, `StageDefinition`, all 8 progression rule types, `GenericWorkoutRow`, `GenericSlotRow`, `SetLogEntry`, `ResolvedPrescription`, `ConfigField`, `GenericResults`
  - `engine.go` — `ComputeGenericProgram`, `RoundToNearest`, `RoundToNearestHalf`, `ConfigToNum`, `ParseMixedConfig`, `deriveSlotResult`, `applyRule`
  - `stats.go` — `ExtractAllGenericStats`, `FormatDateLabel` (es-ES locale via hardcoded month table)
  - `graduation.go` — `ComputeGraduationTargets`, `CheckGraduationCriterion`, `ComputeEpley1RM`, `SuggestNextWeight`
  - `hydrate.go` — `HydrateProgramDefinition` (DB JSONB → validated `ProgramDefinition` struct)
  - `engine_test.go` — unit tests for every progression rule type, set-log derivation, rounding edge cases, prescription slots, GPP slots, TM update, deload detection
- Extend `apps/go-api/internal/service/catalog.go`: add `PreviewDefinition`
- Extend `apps/go-api/internal/handler/catalog.go`: add `HandlePreview`
- Register `POST /api/catalog/preview` in `apps/go-api/internal/server/server.go` behind `mw.RequireAuth`
- In-process rate limiting (30 req / hour per userId) using `sync.Map` — no Redis dependency (single-process deployment)
- Extend `apps/harness/src/tests/catalog.test.ts` with preview test cases
- Extend `apps/harness/src/schemas/catalog.ts` with `GenericWorkoutRowSchema`

**Out of scope:**

- Redis-backed rate limiting
- Wiring stats/graduation into any existing endpoint
- Modifying `packages/shared/` TypeScript engine
- The full program-instance compute path (`GET /api/programs/:id`) — separate slice

## Approach

Steps are strictly bottom-up: types → engine → stats → graduation → hydrate → service → handler → route → tests.

**Step 1 — `internal/engine/types.go`**

Define Go structs matching the TS types exactly. Use pointer fields (`*string`, `*bool`, `*int`, `*float64`) for optional fields that must be omitted (not zero-valued) in JSON. Key decisions:

- `ProgressionRule` as a flat struct with `RuleType string` plus optional pointer fields for extras (`Percent`, `Amount`, `MinAmrapReps`, `RepRangeTop`, `RepRangeBottom`).
- `GenericSlotRow.Result` is `*string` (omitted when nil).
- Required-always fields (`Weight`, `Stage`, `Sets`, `Reps`, `IsAmrap`, `IsChanged`, `IsDeload`, `StagesCount`) use value types WITHOUT `omitempty` — they must always serialize even when zero/false.
- Optional fields (`RepsMax`, `AmrapReps`, `Rpe`, `Role`, `Notes`, `Prescriptions`, `IsGpp`, `SetLogs`, etc.) use pointer or slice types WITH `omitempty`.

**Step 2 — `internal/engine/engine.go`**

Port `computeGenericProgram` from `packages/shared/src/generic-engine.ts`. Critical implementation notes:

- `RoundToNearest(value, step float64) float64`: if step <= 0 → delegate to `RoundToNearestHalf`. Else: `math.Round(math.Round(value/step*1000)/1000 * step)` — the inner 1000-factor sanitizes floating-point artifacts.
- `ConfigToNum(config map[string]any, key string) float64`: handle `float64` (Go's JSON default), `string` (parse with `strconv.ParseFloat`), missing key → 0.
- TM state: `map[string]float64`, initialized once from config per unique `trainingMaxKey`.
- `prevWeightByExerciseId`: `map[string]float64`, persists entire program replay.
- `deriveSlotResult`: mirror exactly including `progressionSetIndex` slice.
- Slot snapshot happens BEFORE progression in same workout iteration.

**Step 3 — `internal/engine/stats.go`**

Port `extractAllGenericStats`. es-ES month table (hardcoded, lowercase, no trailing period): `["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]`. Same-year: `"2 feb"`, prior-year: `"2 feb 25"` (2-digit via `time.Format("06")`).

**Step 4 — `internal/engine/graduation.go`**

Port four pure functions — `ComputeGraduationTargets`, `CheckGraduationCriterion`, `ComputeEpley1RM`, `SuggestNextWeight`. Call `RoundToNearest` from same package.

**Step 5 — `internal/engine/hydrate.go`**

`HydrateProgramDefinition(defRaw json.RawMessage, exerciseRows []ExerciseRow) (ProgramDefinition, error)`:

1. Unmarshal raw JSON into `ProgramDefinition`.
2. Collect all exerciseId values across all slots.
3. Build id→name map from `exerciseRows`.
4. Inject names into each slot's `ExerciseName` field.
5. Return error if any exerciseId is missing from the map.

**Step 6 — `internal/engine/engine_test.go`**

Table-driven tests:

- `RoundToNearest`: step=2.5 (67.499999 → 67.5), step=0 (→ half), negative → 0
- `ConfigToNum`: number, string, missing, non-numeric string
- All 8 progression rule types via single-slot program replay
- Set-log derivation: `double_progression` ranges, simple threshold, `progressionSetIndex`
- Prescription slot weight calculation
- GPP slot always weight=0, stage=0
- TM update both branches (reps met / not met)
- Deload detection across exerciseId history
- Full GZCLP first 10 rows: embed definition JSON in `testdata/gzclp.json`, assert weights match TS oracle

**Step 7 — Extend `internal/service/catalog.go`**

Add `PreviewDefinition(def engine.ProgramDefinition, config map[string]any) ([]engine.GenericWorkoutRow, error)`:

- Resolve config per `def.ConfigFields` (weight → provided or 0; select → provided or options[0].Value).
- Call `engine.ComputeGenericProgram(def, resolved, nil)`.
- Return `rows[:min(10, len(rows))]`.

**Step 8 — Extend `internal/handler/catalog.go`**

Add `HandlePreview(w, r)`:

- Decode JSON body `{ "definition": <raw>, "config": <map> }`.
- Unmarshal definition into `engine.ProgramDefinition`; return 422 on error.
- Apply rate limit (30/hour per userId from context); return 429 on exceeded.
- Call `service.PreviewDefinition`; return 500 on error.
- Encode response.

Rate limit: package-level `sync.Map` keyed by userId, storing `{count int, windowStart time.Time}`. Reset window when `time.Since(windowStart) > time.Hour`.

**Step 9 — Register route in `internal/server/server.go`**

Add inside `/api/catalog` block:

```go
api.With(mw.RequireAuth(cfg.JWTSecret)).Post("/catalog/preview", cat.HandlePreview)
```

Before the existing public catalog GET routes.

**Step 10 — Extend harness**

`apps/harness/src/schemas/catalog.ts`: add `GenericSlotRowSchema` and `GenericWorkoutRowSchema` (Zod, `.strict()`).

`apps/harness/src/tests/catalog.test.ts`: add preview describe block — 401 (no auth), 422 (invalid definition), 200 with GZCLP fixture (length ≤ 10, schema validates).

## Change Size

**L (Large)**

~900–1200 lines of new Go across 5 new files plus extensions to 4 existing. The engine alone mirrors 497 TS lines with a complex behavioral contract. Not XL because: no DB migrations, TS oracle is fully documented, no new external dependencies.

## Risk Level

**High**

**Top 3 risks:**

1. **Float arithmetic divergence.** `RoundToNearest` double-round pattern must sanitize float artifacts identically to JS `Math.round`. Go and JS round identically for well-formed floats but intermediate precision may differ. Mitigation: derive expected values from the TS engine and write them as literal test fixtures before implementing Go code.

2. **JSON null-vs-omit serialization.** `false` and `0` are Go zero values. `isAmrap: false`, `isChanged: false`, `weight: 0` must still appear in JSON. Only genuinely-optional fields (`result`, `amrapReps`, `rpe`, `repsMax`, etc.) use pointer+omitempty. The harness `.strict()` schema will catch extra keys; missing required keys cause schema parse failures.

3. **es-ES date formatting.** Go has no Intl locale support. Hardcoded Spanish month abbreviations must match exactly what Node.js `Intl.DateTimeFormat('es-ES', {month:'short'})` produces. Verify each of the 12 values against Node.js before coding. (Stats are not on the preview path so this risk is deferred but must still be correct.)

## Rollback Plan

All changes are purely additive. No DB migrations, no schema changes, no config changes.

To roll back:

1. Delete `apps/go-api/internal/engine/` (entire directory).
2. Remove `HandlePreview` from `internal/handler/catalog.go`.
3. Remove `PreviewDefinition` from `internal/service/catalog.go`.
4. Remove the `POST /catalog/preview` route line from `internal/server/server.go`.
5. Revert harness additions.

The Go API compiles and all existing tests pass before and after rollback.

## Success Criteria

1. `go test ./internal/engine/...` passes — all rule types, GZCLP fixture replay weights match TS oracle for workouts 0–9.
2. `POST /api/catalog/preview` (Go API) with valid GZCLP definition → HTTP 200, JSON array ≤ 10 items, each passes `GenericWorkoutRowSchema.strict()`.
3. `POST /api/catalog/preview` without auth → HTTP 401 `{ error, code: "UNAUTHORIZED" }`.
4. `POST /api/catalog/preview` with `{ "definition": {} }` → HTTP 422 `{ error, code: "VALIDATION_ERROR" }`.
5. `bun run test:harness` passes (harness pointed at Go API) — including new preview test cases.
6. `bun run typecheck && bun run lint && bun run test` (monorepo TS) unchanged — no regression.
7. `go build ./cmd/api` compiles cleanly, `go vet ./...` no warnings.
