---
summary: Full behavioral contract of the TS progression engine and /catalog/preview endpoint, captured as oracle for the Go port.
read_when: Implementing internal/engine Go package or wiring /catalog/preview handler.
---

# Explore: go-api-engine-port

**Change:** Port the TypeScript progression engine (computeGenericProgram, generic-stats, graduation) to Go as internal/engine, then wire /catalog/preview using it.

---

## Current State

The TS engine lives in `packages/shared/src/` and is the core computation kernel. It is a pure function `computeGenericProgram(definition, config, results)` that deterministically replays all workout results and computes the current state of every slot. It has no DB dependency.

`/catalog/preview` (POST) uses the engine to simulate a program's first 10 workouts given a raw definition and optional config. It is currently **not implemented** in the Go API — the handler only has `HandleList` and `HandleGetDefinition`.

The Go API compiles and tests pass, but `/catalog/preview` returns 404. The engine package (`internal/engine/`) does not exist.

---

## Relevant Files

| File                                                   | Role                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `packages/shared/src/generic-engine.ts`                | Core engine — oracle for Go port                             |
| `packages/shared/src/generic-engine.test.ts`           | Unit tests per rule type                                     |
| `packages/shared/src/generic-engine.scenarios.test.ts` | Full replay scenarios                                        |
| `packages/shared/src/generic-engine.fuzz.test.ts`      | Property-based stress tests                                  |
| `packages/shared/src/generic-stats.ts`                 | Stats extraction from rows                                   |
| `packages/shared/src/generic-stats.test.ts`            | Stats tests                                                  |
| `packages/shared/src/graduation.ts`                    | Graduation target/criterion logic                            |
| `packages/shared/src/graduation.test.ts`               | Graduation tests                                             |
| `packages/shared/src/types/program.ts`                 | ProgramDefinition and sub-types                              |
| `packages/shared/src/types/index.ts`                   | GenericWorkoutRow, GenericSlotRow, etc.                      |
| `packages/shared/test/fixtures.ts`                     | Test fixture factories                                       |
| `apps/api/src/routes/catalog.ts`                       | Preview route registration + rate limit                      |
| `apps/api/src/services/catalog.ts`                     | Preview service (validation, config resolution, engine call) |
| `apps/api/src/lib/hydrate-program.ts`                  | Exercise name hydration into definition                      |
| `apps/harness/src/tests/catalog.test.ts`               | HTTP contract tests for catalog endpoints                    |
| `apps/harness/src/schemas/catalog.ts`                  | Zod schemas for catalog response validation                  |
| `openspec/contract/http-contract.md`                   | Full HTTP contract reference                                 |
| `apps/go-api/internal/handler/catalog.go`              | Existing Go catalog handler (to extend)                      |
| `apps/go-api/internal/service/catalog.go`              | Existing Go catalog service (to extend)                      |
| `apps/go-api/internal/model/types.go`                  | Existing Go model types (to extend)                          |
| `apps/go-api/go.mod`                                   | Go module dependencies                                       |

---

## 1. Engine Core Contract

**Function signature** (`packages/shared/src/generic-engine.ts:281-285`):

```typescript
computeGenericProgram(
  definition: ProgramDefinition,
  config: Record<string, number | string>,
  results: GenericResults
): GenericWorkoutRow[]
```

- Replays all workouts from index 0 to N deterministically.
- Returns exactly `definition.totalWorkouts` rows.
- Each row is a snapshot of slot state BEFORE progression is applied, then progression mutates state for the next iteration.
- `config` holds starting weights and select field values keyed by slot config keys.
- `results` is a `Record<string, SlotResult>` keyed by `"<workoutIndex>:<slotId>"`.

---

## 2. Rounding Rules

**`roundToNearestHalf(value)`** (`generic-engine.ts:10-16`):

- `Math.round(value * 2) / 2`
- Returns 0 if value < 0 or non-finite.

**`roundToNearest(value, step)`** (`generic-engine.ts:18-23`):

- If step <= 0: delegate to `roundToNearestHalf`.
- Else: `Math.round(Math.round(value / step * 1000) / 1000) * step`
  - The inner `Math.round(...* 1000) / 1000` sanitizes floating-point artifacts.
- Clamps to >= 0.

**Go port must**: round to 3 decimal places before final rounding to avoid float divergence.

---

## 3. Config Parsing

**`configToNum(config, key)`** (`generic-engine.ts:271-279`):

- If key is undefined: return 0.
- If config[key] is number: return it.
- If config[key] is string: `parseFloat(s)`, return if finite, else 0.
- Missing key: return 0.
- Never negative (clamped at usage sites).

**`parseMixedConfig(raw)`** (`apps/api/src/routes/catalog.ts:17-25`):

- Returns undefined if raw is not a plain object.
- Extracts only `number | string` values; ignores arrays/objects/null.

**Preview config resolution** (`apps/api/src/services/catalog.ts:166-192`):

- For each slot's `configKeys`:
  - Weight fields: use provided value if present, else 0.
  - Select fields: use provided value if present, else `options[0].value`.

---

## 4. Progression Rules (Complete Enum)

All rules are discriminated unions on `type` field.

| Rule Type                  | Extra Fields                  | Behavior                                                                |
| -------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `add_weight`               | —                             | `weight += increment`                                                   |
| `advance_stage`            | —                             | `stage = min(stage+1, maxStageIdx)`                                     |
| `advance_stage_add_weight` | —                             | Both advance and add weight                                             |
| `deload_percent`           | `percent: number (1–99)`      | `weight *= (1 - percent/100)`, reset stage to 0                         |
| `add_weight_reset_stage`   | `amount: number`              | `weight += amount`, reset stage to 0                                    |
| `no_change`                | —                             | State unchanged                                                         |
| `double_progression`       | `repRangeTop, repRangeBottom` | Treated as `add_weight` in application; deriveSlotResult handles ranges |
| `update_tm`                | `amount, minAmrapReps`        | If amrapReps >= minAmrapReps: tmState[trainingMaxKey] += amount         |

**Rule selection logic** (`generic-engine.ts:213-260`):

- If result === `'fail'`: apply `onFinalStageFail` (at final stage) or `onMidStageFail` (mid stage).
- If result === `'success'`: apply `onFinalStageSuccess` if at final stage and defined, else `onSuccess`.
- If result === `undefined`: apply `onUndefined` if defined, else `onSuccess`.

**Stage index**: `maxStageIdx = slot.stages.length - 1`. Stage is 0-indexed internally, 1-indexed in output.

---

## 5. Set-Log Derivation

**`deriveSlotResult(slot, setLogs, slotResult)`** (`generic-engine.ts:83-105`):

1. If setLogs is empty/undefined, return `slotResult.result` directly.
2. If `slot.progressionSetIndex` is defined, use only that index of setLogs.
3. If rule type is `double_progression`:
   - All reps >= `repRangeTop` → `'success'`
   - Any reps < `repRangeBottom` → `'fail'`
   - Otherwise → `undefined`
4. Else (single threshold):
   - All reps >= `targetReps` (stage's reps value) → `'success'`
   - Any reps < `targetReps` → `'fail'`
5. Fall through to `slotResult.result` if no log conclusion.

**AMRAP reps**: taken from last `setLog.reps` when `slot.stage.amrap === true` (`generic-engine.ts:399-404`).

---

## 6. State Initialization

**Per-slot** (`generic-engine.ts:290-306`):

```
base = configToNum(config, slot.startWeightKey)
weight = roundToNearest(
  base * (slot.startWeightMultiplier ?? 1) - (slot.startWeightOffset ?? 0) * increment,
  roundingStep
)
stage = 0
everChanged = false
```

Where `increment = definition.weightIncrements[slot.exerciseId] ?? 0`.

**Training max (TM) state** (`generic-engine.ts:308-316`):

- One entry per unique `trainingMaxKey` across all slots.
- `tmState[key] = configToNum(config, key)`.

---

## 7. Slot Output Fields

**GenericSlotRow** (`packages/shared/src/types/index.ts:19-52`):

```typescript
{
  slotId: string
  exerciseId: string
  exerciseName: string
  tier: string
  weight: number
  stage: number          // 1-indexed (slot.stage + 1)
  sets: number
  reps: number
  repsMax?: number       // undefined for GPP/prescription
  isAmrap: boolean
  stagesCount: number
  result?: ResultValue   // 'success' | 'fail' | undefined
  amrapReps?: number
  rpe?: number
  isChanged: boolean     // slot.everChanged
  isDeload: boolean
  role?: 'primary' | 'secondary' | 'accessory'
  // Optional fields present when non-null in definition:
  notes?: string
  prescriptions?: PrescriptionEntry[]
  isGpp?: boolean
  complexReps?: number
  propagatesTo?: string
  isTestSlot?: boolean
  isBodyweight?: boolean
  setLogs?: SetLog[]
}
```

**GenericWorkoutRow** (`types/index.ts:54-61`):

```typescript
{
  index: number          // 0-based
  dayName: string
  slots: GenericSlotRow[]
  isChanged: boolean     // true if any slot.isChanged
  completedAt?: string   // always undefined from computeGenericProgram
}
```

---

## 8. Special Slot Types

**Prescription slots** (when `slot.prescriptions !== undefined && slot.percentOf !== undefined`):

- `weight = roundToNearest((base1rm * percent) / 100, roundingStep)`
- Working set = last prescription (highest %).
- Always stage=0, stagesCount=1, repsMax=undefined.
- Skip progression entirely.

**GPP slots** (when `slot.isGpp === true`):

- Weight always 0.
- Sets/reps from `slot.stages[0]`.
- Stage=0, stagesCount=1.
- Skip progression.
- Output: `isGpp: true`.

---

## 9. Deload Detection

**Algorithm** (`generic-engine.ts:418-423`):

```typescript
const prevWeight = prevWeightByExerciseId.get(slot.exerciseId);
const isDeload = prevWeight !== undefined && weight > 0 && weight < prevWeight;
if (weight > 0) {
  prevWeightByExerciseId.set(slot.exerciseId, weight);
}
```

- One map entry per exerciseId, persists across entire workout history.
- isDeload is true only if weight > 0 AND weight < previous weight for that exercise.

---

## 10. Role Resolution

**TIER_ROLE_MAP** (`generic-engine.ts:162-166`):

```typescript
{ t1: 'primary', t2: 'secondary', t3: 'primary' }
```

- If `slot.role` explicitly set: use it.
- Else map `slot.tier` through TIER_ROLE_MAP.
- Unknown tiers → `undefined` (not null, not empty string).

---

## 11. generic-stats Contract

**`extractAllGenericStats(rows: GenericWorkoutRow[]): AllGenericStats`** (`generic-stats.ts:34-39`):

```typescript
{
  chartData: Record<string, ChartDataPoint[]>    // keyed by exerciseId
  rpeData:   Record<string, RpeDataPoint[]>
  amrapData: Record<string, AmrapDataPoint[]>
  volumeData: VolumeDataPoint[]
}
```

**ChartDataPoint** (`types/index.ts:63-70`):

```typescript
{
  workout: number         // row.index + 1 (1-indexed)
  weight: number
  stage: number           // slot.stage + 1 (1-indexed)
  result: ResultValue | null  // null when undefined (JSON-serializable)
  date?: string           // es-ES locale formatted
  amrapReps?: number
}
```

**Volume calculation** (`generic-stats.ts:65-70`):

- Only success slots contribute.
- If setLogs present: `sum(setLog.weight ?? slot.weight * setLog.reps)`.
- Else: `slot.weight * slot.sets * slot.reps`.
- Rounded to nearest integer.

**Date formatting** (`generic-stats.ts:50-58`):

- Locale: `es-ES`, `{ day: 'numeric', month: 'short' }`.
- Same year as today: "12 feb" (no year shown).
- Prior year: "3 nov 25" (2-digit year appended).
- Invalid dates → `undefined`.

---

## 12. Graduation Contract

**`computeGraduationTargets(bodyweight, gender, rounding)`** (`graduation.ts:35-63`):

- Multiplier: female=0.7, male=1.0.
- Targets squat (3 reps), bench (1 rep), deadlift (10 reps).
- `weight = roundToNearest(bodyweight * multiplier, rounding)`.

**`checkGraduationCriterion(exercise, weight, reps, targetWeight)`** (`graduation.ts:71-87`):

- Returns true if weight >= targetWeight AND reps >= exercise-specific min.
- Squat: >= 3 reps, Bench: >= 1 rep, Deadlift: >= 10 reps.

**`computeEpley1RM(weight, reps)`** (`graduation.ts:93-96`):

- `weight * (1 + reps / 30)`.
- Returns 0 if weight <= 0 or reps <= 0.

**`suggestNextWeight(prev, secondPrev, rounding)`** (`graduation.ts:105-123`):

- No prev → null.
- No secondPrev → `roundToNearest(prev + rounding, rounding)`.
- prev > secondPrev → prev (consolidate gains).
- Else → `roundToNearest(prev + rounding, rounding)`.

---

## 13. Hydrate-Program Contract

**`hydrateProgram(template, exerciseRows)`** (`apps/api/src/lib/hydrate-program.ts:105-169`):

1. Parse `template.definition` as JSON (if string) or use as-is.
2. Collect all `exerciseId` references from slots.
3. Build lookup from `exerciseRows` (id → name).
4. Inject exercise names into definition.
5. Validate against `ProgramDefinitionSchema` (Zod).
6. Return `Result<ProgramDefinition, HydrationError>`.

**Error types**: `INVALID_DEFINITION`, `MISSING_EXERCISE_REFERENCE`, `SCHEMA_VALIDATION_FAILED`.

---

## 14. /catalog/preview Endpoint (HTTP Contract)

**Method:** POST
**Path:** `/api/catalog/preview`
**Auth:** Required (access JWT)
**Rate limit:** 30 req / 3,600,000 ms window / key: userId

**Request body:**

```json
{
  "definition": <ProgramDefinition JSON>,
  "config": <optional Record<string, number|string>>
}
```

**Response:** `GenericWorkoutRow[]` — first 10 rows max (`MAX_PREVIEW_ROWS = 10`).

**Process** (`apps/api/src/services/catalog.ts:225-247`):

1. Parse definition against `ProgramDefinitionSchema` (422 on failure).
2. Resolve config per slot configKeys (weight → 0 default, select → options[0].value default).
3. Call `computeGenericProgram(definition, resolvedConfig, {})` — empty results.
4. Return `rows.slice(0, MAX_PREVIEW_ROWS)`.

**Error responses:**

- 401: Missing/invalid token (`UNAUTHORIZED`)
- 422: Invalid definition (`VALIDATION_ERROR`)
- 429: Rate limited (`RATE_LIMITED`)
- 500: Engine failure (`INTERNAL_ERROR`)

**Response headers**: No special cache headers (unlike GET /catalog which has Cache-Control).

---

## 15. Harness Catalog Tests

**File:** `apps/harness/src/tests/catalog.test.ts`

Tests:

- `GET /api/catalog` — list with Cache-Control validation.
- `GET /api/catalog/{id}` — single definition fetch.
- `POST /api/catalog/preview` — requires auth, validates GenericWorkoutRow shape.

**Schema:** `apps/harness/src/schemas/catalog.ts` — Zod `.strict()` on preview response shape.

---

## 16. Existing Go Type Gaps

**Current `model/types.go`**: Has basic API response types but MISSING:

- `ProgramDefinition` (full definition schema with workouts/days/slots/stages/rules)
- `GenericWorkoutRow`
- `GenericSlotRow`
- `SlotResult` / `SetLog`
- `PrescriptionEntry`
- All progression rule types
- Config key types

These must be added as new Go types in `internal/model/` or a new `internal/engine/` package.

---

## Risk Assessment

### High Risk

1. **Float arithmetic** — `roundToNearest` uses `Math.round(value/step*1000)/1000` to sanitize. Go port must mirror exactly.
2. **Date formatting (es-ES)** — "3 nov 25" format. Go's `time.Format` doesn't support locale-specific month names; need custom lookup.
3. **Null vs omit** — TS undefined fields serialize as absent JSON keys; Go zero-value structs serialize as present. Must use pointer types or `omitempty` carefully.
4. **AMRAP reps source** — from last `setLog.reps` when `isAmrap`, NOT from `slotResult.amrapReps`. Easy to confuse.

### Medium Risk

1. **Stage boundary** — `stage >= maxStageIdx` (final stage) vs `stage < maxStageIdx` (mid). Off-by-one = wrong rule applied.
2. **SetLog derivation timing** — must happen before storing result, which is then used during progression. Order matters.
3. **TM mid-loop mutation** — `update_tm` rule modifies shared `tmState` mid-workout; later slots in same workout see the updated TM.
4. **Config defaults for preview** — weight→0, select→options[0].value. Incorrect defaults break all preview output.

### Low Risk

1. Routing — straightforward POST registration.
2. Auth middleware — already wired.
3. Request parsing — standard JSON body decode.

---

## Files to Create

| Go file                                  | TS oracle                                                 |
| ---------------------------------------- | --------------------------------------------------------- |
| `internal/engine/types.go`               | `packages/shared/src/types/program.ts` + `types/index.ts` |
| `internal/engine/generic_engine.go`      | `packages/shared/src/generic-engine.ts`                   |
| `internal/engine/generic_engine_test.go` | `generic-engine.test.ts` + scenarios tests                |
| `internal/engine/generic_stats.go`       | `packages/shared/src/generic-stats.ts`                    |
| `internal/engine/graduation.go`          | `packages/shared/src/graduation.ts`                       |
| `internal/engine/hydrate.go`             | `apps/api/src/lib/hydrate-program.ts`                     |
| `internal/handler/catalog.go` (extend)   | add `HandlePreview`                                       |
| `internal/service/catalog.go` (extend)   | add `PreviewDefinition`                                   |

Total new Go code: ~800–1200 lines estimated.
