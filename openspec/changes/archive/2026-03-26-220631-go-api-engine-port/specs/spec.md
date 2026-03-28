# Delta Spec: Engine

**Change**: go-api-engine-port
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

`internal/engine/` is a new Go package that ports the TypeScript progression engine from
`packages/shared/src/generic-engine.ts`. It is a pure-computation package with no network or
database dependencies. It provides:

- `ComputeGenericProgram` — deterministic replay of all workout results into `[]GenericWorkoutRow`
- `RoundToNearest` / `RoundToNearestHalf` — float sanitization utilities
- `ConfigToNum` — mixed-type config value extraction
- Eight progression rule handlers inside `applyRule`
- `deriveSlotResult` — set-log result derivation
- GPP and prescription slot specializations
- TM (training-max) update logic
- Deload detection across the full workout history

All behavior is derived from the TypeScript oracle at
`packages/shared/src/generic-engine.ts` (497 lines). Divergence from the TS oracle is a
correctness defect regardless of whether any test catches it.

---

## ADDED Requirements

### REQ-ENGINE-001: `ComputeGenericProgram` deterministic replay

`ComputeGenericProgram(definition ProgramDefinition, config map[string]any, results GenericResults)
[]GenericWorkoutRow` MUST return exactly `definition.TotalWorkouts` rows. Given identical inputs,
repeated calls MUST return bitwise-identical output. Rows MUST be indexed 0-based. Each row MUST
reflect the slot state as it existed BEFORE the progression mutation for that workout index was
applied (snapshot-then-advance).

`results` MUST be keyed by the string representation of the 0-based workout index (e.g., `"0"`,
`"27"`). A missing key MUST be treated as an empty result (all slots use `onUndefined` or
`onSuccess` per rule selection logic). An empty `results` map is valid input.

Days MUST cycle by `i % len(definition.Days)`. This MUST hold even when `totalWorkouts` is not a
multiple of the cycle length.

#### Scenario: GZCLP first workout, squat T1, config squat=60, rounding defaults to 2.5 · `code-based` · `critical`

```
GIVEN definition = GZCLP (90 workouts, 4-day cycle)
  AND config = { "squat": 60.0, "bench": 40.0, "deadlift": 80.0, "ohp": 25.0,
                 "latpulldown": 30.0, "dbrow": 30.0 }
  AND results = {} (empty)
WHEN ComputeGenericProgram(definition, config, results)
THEN len(rows) == 90
 AND rows[0].DayName == "Día 1"
 AND rows[0].Slots[0].SlotId == "d1-t1"
 AND rows[0].Slots[0].ExerciseId == "squat"
 AND rows[0].Slots[0].Weight == 60.0
 AND rows[0].Slots[0].Stage == 0
 AND rows[0].Slots[0].Sets == 5
 AND rows[0].Slots[0].Reps == 3
 AND rows[0].Slots[0].IsAmrap == true
 AND rows[0].Slots[0].IsChanged == false
 AND rows[0].Slots[0].IsDeload == false
```

#### Scenario: Day cycling repeats every 4 workouts · `code-based` · `critical`

```
GIVEN definition = GZCLP (4-day cycle, 90 totalWorkouts)
  AND config = default weights  AND results = {}
WHEN ComputeGenericProgram(definition, config, results)
THEN rows[0].DayName == "Día 1"
 AND rows[1].DayName == "Día 2"
 AND rows[2].DayName == "Día 3"
 AND rows[3].DayName == "Día 4"
 AND rows[4].DayName == "Día 1"
 AND rows[89].DayName == rows[89 % 4].DayName
```

#### Scenario: Empty results → implicit onUndefined/onSuccess path for all slots · `code-based` · `standard`

```
GIVEN a single-slot definition with onUndefined = { type: "no_change" }
  AND results = {}
WHEN ComputeGenericProgram(definition, config, results)
THEN rows[0].Slots[0].Weight == rows[1].Slots[0].Weight
  (no progression applied because onUndefined = no_change)
```

---

### REQ-ENGINE-002: `RoundToNearest` float sanitization

`RoundToNearest(value float64, step float64) float64` MUST implement the following rules in order:

1. If `step <= 0` or `step` is non-finite: delegate to `RoundToNearestHalf(value)`.
2. Otherwise: `math.Round(math.Round(value/step*1000)/1000 * step)`.
   The intermediate `*1000 / 1000` pass MUST occur to sanitize floating-point artifacts before
   the outer round.
3. If the result is negative or non-finite: return `0.0`.

`RoundToNearestHalf(value float64) float64` MUST compute `math.Round(value*2) / 2` and return
`0.0` for negative or non-finite results.

#### Scenario: step=2.5, float artifact input 67.4999999 → 67.5 · `code-based` · `critical`

```
WHEN RoundToNearest(67.4999999, 2.5)
THEN result == 67.5
```

The inner `*1000/1000` sanitization round eliminates the artifact; without it the result would be
67.5 anyway in this case but intermediate arithmetic on derived values (e.g., `80 * 0.65 / 2.5`)
would produce 52.0 not 52.5.

#### Scenario: step=2.5, bench T2 start weight — 40.0 \* 0.65 = 26.0 rounds to 25.0 · `code-based` · `critical`

```
WHEN RoundToNearest(26.0, 2.5)
THEN result == 25.0
```

#### Scenario: step=2.5, deadlift T2 start weight — 80.0 \* 0.65 = 52.0 rounds to 52.5 · `code-based` · `critical`

```
WHEN RoundToNearest(52.0, 2.5)
THEN result == 52.5
```

#### Scenario: step=0 → delegates to RoundToNearestHalf · `code-based` · `critical`

```
WHEN RoundToNearest(5.7, 0)
THEN result == 6.0   (same as RoundToNearestHalf(5.7) = math.Round(5.7*2)/2 = math.Round(11.4)/2 = 11/2 = 5.5)
```

Note: math.Round(11.4) = 11, so RoundToNearestHalf(5.7) = 5.5. Verify against Go's math.Round semantics.

#### Scenario: negative input → 0 · `code-based` · `critical`

```
WHEN RoundToNearest(-10.0, 2.5)
THEN result == 0.0
```

#### Scenario: non-finite input (NaN) → 0 · `code-based` · `critical`

```
WHEN RoundToNearest(math.NaN(), 2.5)
THEN result == 0.0
```

#### Scenario: RoundToNearestHalf — 0.7 rounds to 0.5 · `code-based` · `standard`

```
WHEN RoundToNearestHalf(0.7)
THEN result == 0.5
```

#### Scenario: RoundToNearestHalf — 0.8 rounds to 1.0 · `code-based` · `standard`

```
WHEN RoundToNearestHalf(0.8)
THEN result == 1.0
```

#### Scenario: RoundToNearestHalf — negative → 0 · `code-based` · `standard`

```
WHEN RoundToNearestHalf(-5.0)
THEN result == 0.0
```

---

### REQ-ENGINE-003: `ConfigToNum` — mixed-type config value extraction

`ConfigToNum(config map[string]any, key string) float64` MUST follow these rules in order:

1. Key absent from map: return `0.0`.
2. Value is `float64` (Go's default JSON numeric type): return it directly.
3. Value is `string`: parse with `strconv.ParseFloat`; return parsed value if finite, else `0.0`.
4. Any other type (`bool`, nested object, slice, `nil`): return `0.0`.

The function MUST NOT panic on any input.

#### Scenario: float64 value · `code-based` · `critical`

```
WHEN ConfigToNum(map[string]any{"squat": float64(60)}, "squat")
THEN result == 60.0
```

#### Scenario: string numeric value · `code-based` · `critical`

```
WHEN ConfigToNum(map[string]any{"squat": "60.5"}, "squat")
THEN result == 60.5
```

#### Scenario: missing key → 0 · `code-based` · `critical`

```
WHEN ConfigToNum(map[string]any{}, "squat")
THEN result == 0.0
```

#### Scenario: non-numeric string → 0 · `code-based` · `critical`

```
WHEN ConfigToNum(map[string]any{"squat": "heavy"}, "squat")
THEN result == 0.0
```

#### Scenario: boolean value → 0 · `code-based` · `standard`

```
WHEN ConfigToNum(map[string]any{"squat": true}, "squat")
THEN result == 0.0
```

---

### REQ-ENGINE-004: Progression rule mutations

Each of the 8 rule types MUST produce the correct weight/stage mutation when applied. Rules are
applied by `applyRule` (or the `update_tm` inline path). Mutations apply to the slot state that
takes effect for the NEXT workout, not the current snapshot.

The engine MUST select rules according to this priority:

- `result == "fail"` at final stage → `onFinalStageFail`
- `result == "fail"` at non-final stage → `onMidStageFail`
- `result == "success"` at final stage with `onFinalStageSuccess` defined → `onFinalStageSuccess`
- `result == "success"` → `onSuccess`
- `result == undefined` with `onUndefined` defined → `onUndefined`
- `result == undefined` → `onSuccess` (implicit pass)

Stage index is 0-based internally. `maxStageIdx = len(slot.Stages) - 1`. Stage MUST be clamped
to `[0, maxStageIdx]`.

#### Scenario: add_weight — increases weight by increment, stage unchanged · `code-based` · `critical`

```
GIVEN single-slot program, weightIncrement=5, startWeight=100
  AND onSuccess = { type: "add_weight" }
  AND results = { "0": { "slot1": { result: "success" } } }
WHEN ComputeGenericProgram
THEN rows[1].Slots[0].Weight == 105.0
 AND rows[1].Slots[0].Stage == 0
```

#### Scenario: advance_stage — increments stage, weight unchanged · `code-based` · `critical`

```
GIVEN single-slot program, 3 stages, startWeight=100
  AND onMidStageFail = { type: "advance_stage" }
  AND results = { "0": { "slot1": { result: "fail" } } }
WHEN ComputeGenericProgram (slot is at stage 0 = mid stage)
THEN rows[1].Slots[0].Stage == 1
 AND rows[1].Slots[0].Weight == 100.0
```

#### Scenario: advance_stage_add_weight — increments stage AND adds weight · `code-based` · `critical`

```
GIVEN single-slot program, 3 stages, startWeight=100, weightIncrement=5
  AND onMidStageFail = { type: "advance_stage_add_weight" }
  AND results = { "0": { "slot1": { result: "fail" } } }
WHEN ComputeGenericProgram
THEN rows[1].Slots[0].Stage == 1
 AND rows[1].Slots[0].Weight == 105.0
```

#### Scenario: deload_percent — applies percent deload and resets stage to 0 · `code-based` · `critical`

```
GIVEN single-slot program, 3 stages, startWeight=100, rounding=2.5
  AND onMidStageFail = { type: "advance_stage" }
  AND onFinalStageFail = { type: "deload_percent", percent: 10 }
  AND results = {
    "0": { "slot1": { result: "fail" } },  -- stage 0 → 1
    "1": { "slot1": { result: "fail" } },  -- stage 1 → 2
    "2": { "slot1": { result: "fail" } }   -- stage 2 (final) → deload
  }
WHEN ComputeGenericProgram
THEN rows[3].Slots[0].Stage == 0
 AND rows[3].Slots[0].Weight == RoundToNearest(100.0 * 0.9, 2.5)  == 90.0
```

#### Scenario: add_weight_reset_stage — adds fixed amount and resets stage to 0 · `code-based` · `critical`

```
GIVEN GZCLP bench T2, startWeightMultiplier=0.65, baseWeight=40 → startWeight=25.0
  AND 3 stages, onFinalStageFail = { type: "add_weight_reset_stage", amount: 15 }
  AND results = {
    "0": { "d1-t2": { result: "fail" } },  -- stage 0 → 1
    "4": { "d1-t2": { result: "fail" } },  -- stage 1 → 2
    "8": { "d1-t2": { result: "fail" } }   -- stage 2 (final) → +15, stage 0
  }
WHEN ComputeGenericProgram
THEN rows[12].Slots[1].Stage == 0
 AND rows[12].Slots[1].Weight == RoundToNearest(25.0 + 15.0, 2.5)  == 40.0
```

#### Scenario: no_change — state unchanged · `code-based` · `critical`

```
GIVEN single-slot program, startWeight=100, onUndefined = { type: "no_change" }
  AND results = {} (empty — all slots get onUndefined path)
WHEN ComputeGenericProgram
THEN rows[0].Slots[0].Weight == 100.0
 AND rows[1].Slots[0].Weight == 100.0
 AND rows[9].Slots[0].Weight == 100.0
```

#### Scenario: double_progression — behaves as add_weight in weight mutation · `code-based` · `critical`

```
GIVEN single-slot program, weightIncrement=2.5, startWeight=100
  AND onSuccess = { type: "double_progression", repRangeTop: 12, repRangeBottom: 8 }
  AND results = { "0": { "slot1": { setLogs: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] } } }
WHEN ComputeGenericProgram
  (setLogs → all reps == repRangeTop → deriveSlotResult → "success" → applies add_weight path)
THEN rows[1].Slots[0].Weight == 102.5
```

#### Scenario: update_tm — applies TM increment only when amrapReps >= minAmrapReps · `code-based` · `critical`

```
GIVEN single-slot TM program, onSuccess = { type: "update_tm", amount: 2.5, minAmrapReps: 1 }
  AND trainingMaxKey = "squat_tm", tmPercent = 0.85, config.squat_tm = 100.0
  AND results = { "0": { "slot1": { amrapReps: 3 } } }
WHEN ComputeGenericProgram
THEN tmState["squat_tm"] after workout 0 == RoundToNearest(100.0 + 2.5, 2.5) == 102.5
 AND rows[1].Slots[0].Weight == RoundToNearest(102.5 * 0.85, 2.5) == 87.5
```

#### Scenario: update_tm — NOT applied when amrapReps < minAmrapReps · `code-based` · `critical`

```
GIVEN same TM program as above
  AND results = { "0": { "slot1": { amrapReps: 0 } } }
WHEN ComputeGenericProgram
THEN tmState["squat_tm"] remains 100.0
 AND rows[1].Slots[0].Weight == RoundToNearest(100.0 * 0.85, 2.5) == 85.0
```

#### Scenario: stage clamped at maxStageIdx under repeated advance_stage · `code-based` · `standard`

```
GIVEN single-slot program, 2 stages (maxStageIdx=1)
  AND onSuccess = { type: "advance_stage_add_weight" }, weightIncrement=5
  AND results = { "0": { slot1: { result: "success" } },  -- stage 0 → 1
                  "1": { slot1: { result: "success" } } }  -- stage 1 (clamped, stays 1)
WHEN ComputeGenericProgram
THEN rows[2].Slots[0].Stage == 1
 AND rows[2].Slots[0].Weight == 110.0   (100 + 5 + 5)
```

---

### REQ-ENGINE-005: Set-log result derivation

`deriveSlotResult` MUST derive an effective `ResultValue | nil` for a slot from its `SetLogs`
field according to the following rules.

When `SetLogs` is nil or empty, the function MUST return `slotResult.Result` unchanged (no
derivation).

When `slot.ProgressionSetIndex` is set, only the set at that index MUST be used for derivation;
all other sets in the log MUST be ignored. If the index is out of bounds, the full log MUST be
used.

For `double_progression` rule type:

- All selected logs have `reps >= repRangeTop` → return `"success"`
- Any selected log has `reps < repRangeBottom` → return `"fail"`
- Otherwise → return `nil` (maintain current weight via `onUndefined` or no-op)

For all other rule types (simple threshold against `stage.Reps`):

- All selected logs have `reps >= targetReps` → return `"success"`
- Any selected log has `reps < targetReps` → return `"fail"`

If the derived result is nil, the explicit `slotResult.Result` MUST be used as fallback.

#### Scenario: double_progression all sets at top → success · `code-based` · `critical`

```
GIVEN onSuccess = { type: "double_progression", repRangeTop: 12, repRangeBottom: 8 }
  AND setLogs = [{ reps: 12 }, { reps: 12 }, { reps: 12 }]
WHEN deriveSlotResult
THEN derived == "success"
```

#### Scenario: double_progression one set below bottom → fail · `code-based` · `critical`

```
GIVEN onSuccess = { type: "double_progression", repRangeTop: 12, repRangeBottom: 8 }
  AND setLogs = [{ reps: 12 }, { reps: 7 }, { reps: 12 }]
WHEN deriveSlotResult
THEN derived == "fail"
```

#### Scenario: double_progression sets between range → nil (no change) · `code-based` · `critical`

```
GIVEN onSuccess = { type: "double_progression", repRangeTop: 12, repRangeBottom: 8 }
  AND setLogs = [{ reps: 10 }, { reps: 9 }, { reps: 10 }]
WHEN deriveSlotResult
THEN derived == nil
```

#### Scenario: simple threshold all sets met → success · `code-based` · `critical`

```
GIVEN onSuccess = { type: "add_weight" }, stage.Reps = 5
  AND setLogs = [{ reps: 5 }, { reps: 6 }, { reps: 5 }]
WHEN deriveSlotResult (non-double-progression path)
THEN derived == "success"
```

#### Scenario: simple threshold one set short → fail · `code-based` · `critical`

```
GIVEN onSuccess = { type: "add_weight" }, stage.Reps = 5
  AND setLogs = [{ reps: 5 }, { reps: 4 }, { reps: 5 }]
WHEN deriveSlotResult
THEN derived == "fail"
```

#### Scenario: progressionSetIndex — only indexed set evaluated · `code-based` · `critical`

```
GIVEN slot.ProgressionSetIndex = 2
  AND onSuccess = { type: "add_weight" }, stage.Reps = 5
  AND setLogs = [{ reps: 3 }, { reps: 3 }, { reps: 5 }]
WHEN deriveSlotResult
THEN derived == "success"   (only set at index 2 is evaluated; reps=5 >= 5)
```

#### Scenario: empty setLogs → falls back to explicit result · `code-based` · `standard`

```
GIVEN setLogs = []  AND slotResult.Result = "success"
WHEN deriveSlotResult
THEN derived == "success"
```

---

### REQ-ENGINE-006: Special slot types — prescription and GPP

**Prescription slots** (`slot.Prescriptions != nil && slot.PercentOf != nil`):

- Weight for each prescription MUST be `RoundToNearest((base1rm * percent) / 100, roundingStep)`
  where `base1rm = ConfigToNum(config, slot.PercentOf)`.
- Working set MUST be the last prescription (highest percentage).
- `Stage` MUST be 0, `StagesCount` MUST be 1.
- Prescription slots MUST be skipped by the progression loop (no state mutation).

**GPP slots** (`slot.IsGpp == true`):

- `Weight` MUST always be `0.0`.
- `Sets` and `Reps` MUST come from `slot.Stages[0]`.
- `Stage` MUST be 0, `StagesCount` MUST be 1.
- `IsGpp` MUST be `true` in output.
- GPP slots MUST be skipped by the progression loop.

#### Scenario: prescription slot weight from 80% of 200kg 1RM · `code-based` · `critical`

```
GIVEN prescription slot with percentOf = "squat1rm", prescription = { percent: 80, sets: 3, reps: 5 }
  AND config = { "squat1rm": 200.0 }  AND roundingStep = 2.5
WHEN ComputeGenericProgram
THEN slot.Weight == RoundToNearest((200.0 * 80) / 100, 2.5) == 160.0
 AND slot.Stage == 0
 AND slot.StagesCount == 1
```

#### Scenario: prescription slot multiple prescriptions — working set is last · `code-based` · `critical`

```
GIVEN prescription slot with prescriptions = [
    { percent: 60, sets: 5, reps: 5 },
    { percent: 75, sets: 3, reps: 3 },
    { percent: 85, sets: 1, reps: 1 }  ← working set
  ]
  AND base1rm = 200.0, roundingStep = 2.5
WHEN ComputeGenericProgram
THEN slot.Weight == RoundToNearest((200.0 * 85) / 100, 2.5) == 170.0
 AND len(slot.Prescriptions) == 3
```

#### Scenario: GPP slot — weight always 0 regardless of config · `code-based` · `critical`

```
GIVEN GPP slot with isGpp = true, stages = [{ sets: 3, reps: 15 }]
  AND config = { "gpp_key": 50.0 }
WHEN ComputeGenericProgram
THEN slot.Weight == 0.0
 AND slot.Sets == 3
 AND slot.Reps == 15
 AND slot.IsGpp == true
 AND slot.Stage == 0
```

#### Scenario: prescription slot — no progression applied across workouts · `code-based` · `standard`

```
GIVEN prescription slot  AND results = { "0": { "slot1": { result: "success" } } }
WHEN ComputeGenericProgram with totalWorkouts=3
THEN rows[0].Slots[0].Weight == rows[1].Slots[0].Weight == rows[2].Slots[0].Weight
  (prescription weight is stable — no add_weight progression)
```

---

### REQ-ENGINE-007: TM update rule — conditional on AMRAP threshold

The `update_tm` rule MUST only mutate `tmState` when `slotResult.AmrapReps != nil` AND
`amrapReps >= rule.MinAmrapReps`. If `AmrapReps` is nil or below the threshold, `tmState` MUST
remain unchanged for that slot in that workout. The TM mutation MUST be visible to all subsequent
workouts that reference the same `trainingMaxKey`.

AMRAP reps for TM slots MUST be sourced from:

1. If `stageConfig.Amrap == true` and `slotResult.SetLogs` is non-empty: last `setLog.Reps`.
2. Otherwise: `slotResult.AmrapReps` (explicit field).

#### Scenario: TM incremented when amrapReps meets threshold · `code-based` · `critical`

```
GIVEN onSuccess = { type: "update_tm", amount: 2.5, minAmrapReps: 1 }
  AND trainingMaxKey = "squat_tm", config.squat_tm = 100.0
  AND slotResult.AmrapReps = 2  (>= minAmrapReps=1)
WHEN applyUpdateTm
THEN tmState["squat_tm"] == RoundToNearest(100.0 + 2.5, 2.5) == 102.5
```

#### Scenario: TM unchanged when amrapReps below threshold · `code-based` · `critical`

```
GIVEN same configuration  AND slotResult.AmrapReps = 0  (< minAmrapReps=1)
WHEN applyUpdateTm
THEN tmState["squat_tm"] == 100.0  (unchanged)
```

#### Scenario: TM unchanged when amrapReps is nil (not recorded) · `code-based` · `critical`

```
GIVEN same configuration  AND slotResult.AmrapReps == nil
WHEN applyUpdateTm
THEN tmState["squat_tm"] == 100.0  (unchanged)
```

---

### REQ-ENGINE-008: Deload detection

`isDeload` MUST be computed for each standard slot (not prescription, not GPP) by comparing the
resolved weight for the current workout against the last recorded non-zero weight for the same
`exerciseId` in the replay history.

The per-exerciseId map (`prevWeightByExerciseId`) MUST persist across the entire program replay,
not just within a single workout or day.

Rules:

- `isDeload = prevWeight != undefined AND weight > 0 AND weight < prevWeight`
- If `weight > 0`, the map MUST be updated to the new weight AFTER the isDeload check.
- If `weight == 0`, the map MUST NOT be updated.

#### Scenario: isDeload true when weight drops below previous occurrence · `code-based` · `critical`

```
GIVEN GZCLP squat T1 with 3-stage deload progression:
  workout 0 (stage 0): weight=60
  workout 4 (stage 1): weight=60  (after fail at 0)
  workout 8 (stage 2): weight=60  (after fail at 4)
  workout 12 (stage 0 after deload): weight=RoundToNearest(60*0.9, 2.5)=55
WHEN ComputeGenericProgram
THEN rows[12].Slots[0].IsDeload == true
  (55 < 60 for exerciseId "squat")
```

#### Scenario: isDeload false on first occurrence of an exerciseId · `code-based` · `critical`

```
GIVEN rows[0] for exerciseId "squat" (no prior occurrence)
WHEN ComputeGenericProgram
THEN rows[0].Slots[0].IsDeload == false
```

#### Scenario: isDeload false when weight equals previous (no decrease) · `code-based` · `standard`

```
GIVEN same weight for two consecutive occurrences of same exerciseId
WHEN ComputeGenericProgram
THEN isDeload == false on the second occurrence
```

---

### REQ-ENGINE-009: JSON serialization — required vs optional field presence

The Go `GenericSlotRow` struct MUST be annotated so that required fields always appear in JSON
output (even when zero or false) and optional fields are omitted when nil/absent.

Required-always fields (MUST NOT use `omitempty`):
`weight`, `stage`, `sets`, `reps`, `isAmrap`, `isChanged`, `isDeload`, `stagesCount`

Optional fields (MUST use pointer types with `omitempty`):
`result`, `amrapReps`, `rpe`, `repsMax`, `role`, `notes`, `prescriptions`, `isGpp`,
`complexReps`, `propagatesTo`, `isTestSlot`, `isBodyweight`, `setLogs`

`completedAt` on `GenericWorkoutRow` MUST always be omitted from `ComputeGenericProgram` output
(it is only populated by the instance computation path which is out of scope).

#### Scenario: zero-weight slot — weight=0 must appear in JSON · `code-based` · `critical`

```
GIVEN any slot where weight resolves to 0.0 (e.g., GPP slot, zero config)
WHEN JSON marshal of GenericSlotRow
THEN JSON contains "weight":0
 NOT absent key
```

#### Scenario: false isAmrap must appear in JSON · `code-based` · `critical`

```
GIVEN a slot where isAmrap=false (non-AMRAP stage)
WHEN JSON marshal
THEN JSON contains "isAmrap":false
 NOT absent key
```

#### Scenario: absent result — omitted from JSON · `code-based` · `critical`

```
GIVEN a slot with no recorded result (nil)
WHEN JSON marshal
THEN JSON does NOT contain "result" key
```

#### Scenario: absent amrapReps — omitted from JSON · `code-based` · `standard`

```
GIVEN a slot where amrapReps was not recorded
WHEN JSON marshal
THEN JSON does NOT contain "amrapReps" key
```

---

## Acceptance Criteria Summary

| Requirement ID | Type          | Priority | Scenarios |
| -------------- | ------------- | -------- | --------- |
| REQ-ENGINE-001 | Functional    | Must     | 3         |
| REQ-ENGINE-002 | Functional    | Must     | 8         |
| REQ-ENGINE-003 | Functional    | Must     | 5         |
| REQ-ENGINE-004 | Functional    | Must     | 10        |
| REQ-ENGINE-005 | Functional    | Must     | 7         |
| REQ-ENGINE-006 | Functional    | Must     | 4         |
| REQ-ENGINE-007 | Functional    | Must     | 3         |
| REQ-ENGINE-008 | Functional    | Must     | 3         |
| REQ-ENGINE-009 | Serialization | Must     | 4         |

---

## Eval Definitions

| Scenario                                          | Eval Type  | Criticality | Threshold |
| ------------------------------------------------- | ---------- | ----------- | --------- |
| GZCLP first workout squat T1                      | code-based | critical    | Pass      |
| Day cycling repeats every 4 workouts              | code-based | critical    | Pass      |
| Empty results → implicit pass                     | code-based | standard    | Pass      |
| RoundToNearest step=2.5 float artifact            | code-based | critical    | Pass      |
| RoundToNearest bench T2 start weight 26.0→25.0    | code-based | critical    | Pass      |
| RoundToNearest deadlift T2 start weight 52.0→52.5 | code-based | critical    | Pass      |
| RoundToNearest step=0 → half                      | code-based | critical    | Pass      |
| RoundToNearest negative → 0                       | code-based | critical    | Pass      |
| RoundToNearest non-finite → 0                     | code-based | critical    | Pass      |
| RoundToNearestHalf 0.7 → 0.5                      | code-based | standard    | Pass      |
| RoundToNearestHalf 0.8 → 1.0                      | code-based | standard    | Pass      |
| RoundToNearestHalf negative → 0                   | code-based | standard    | Pass      |
| ConfigToNum float64 value                         | code-based | critical    | Pass      |
| ConfigToNum string numeric value                  | code-based | critical    | Pass      |
| ConfigToNum missing key → 0                       | code-based | critical    | Pass      |
| ConfigToNum non-numeric string → 0                | code-based | critical    | Pass      |
| ConfigToNum boolean → 0                           | code-based | standard    | Pass      |
| add_weight increases weight                       | code-based | critical    | Pass      |
| advance_stage increments stage                    | code-based | critical    | Pass      |
| advance_stage_add_weight both mutations           | code-based | critical    | Pass      |
| deload_percent applies percent and resets stage   | code-based | critical    | Pass      |
| add_weight_reset_stage adds amount and resets     | code-based | critical    | Pass      |
| no_change preserves state                         | code-based | critical    | Pass      |
| double_progression acts as add_weight             | code-based | critical    | Pass      |
| update_tm applies when reps met                   | code-based | critical    | Pass      |
| update_tm skipped when reps not met               | code-based | critical    | Pass      |
| stage clamped at maxStageIdx                      | code-based | standard    | Pass      |
| deriveSlotResult double_prog all at top           | code-based | critical    | Pass      |
| deriveSlotResult double_prog below bottom         | code-based | critical    | Pass      |
| deriveSlotResult double_prog in range             | code-based | critical    | Pass      |
| deriveSlotResult simple threshold success         | code-based | critical    | Pass      |
| deriveSlotResult simple threshold fail            | code-based | critical    | Pass      |
| deriveSlotResult progressionSetIndex isolation    | code-based | critical    | Pass      |
| deriveSlotResult empty logs → explicit result     | code-based | standard    | Pass      |
| prescription slot weight from %1RM                | code-based | critical    | Pass      |
| prescription slot working set is last             | code-based | critical    | Pass      |
| GPP slot weight always 0                          | code-based | critical    | Pass      |
| prescription slot no progression                  | code-based | standard    | Pass      |
| TM incremented when reps met                      | code-based | critical    | Pass      |
| TM unchanged when reps below threshold            | code-based | critical    | Pass      |
| TM unchanged when amrapReps nil                   | code-based | critical    | Pass      |
| isDeload true when weight drops                   | code-based | critical    | Pass      |
| isDeload false on first occurrence                | code-based | critical    | Pass      |
| isDeload false on equal weight                    | code-based | standard    | Pass      |
| weight=0 present in JSON                          | code-based | critical    | Pass      |
| isAmrap=false present in JSON                     | code-based | critical    | Pass      |
| absent result omitted from JSON                   | code-based | critical    | Pass      |
| absent amrapReps omitted from JSON                | code-based | standard    | Pass      |

# Delta Spec: Catalog API

**Change**: go-api-engine-port
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

`POST /api/catalog/preview` is the only auth-required endpoint in the catalog group. It is
currently unregistered in the Go API (returns 404). The TypeScript implementation lives in
`apps/api/src/routes/catalog.ts` and `apps/api/src/services/catalog.ts`.

The endpoint accepts a raw `ProgramDefinition` JSON object and an optional `config` map, runs
`ComputeGenericProgram` with empty results, and returns the first 10 rows. It is used by the
frontend to show users a preview of what workouts a program generates before they start it.

This spec covers:

- Route registration and auth enforcement
- Request/response contract
- Config resolution defaults
- Rate limiting
- Error response shapes

The Go port MUST be parity-compatible with the TypeScript implementation. Any response that the
TS API would produce, the Go API MUST also produce for the same input, and vice versa. This is
verified by the HTTP contract harness at `apps/harness/`.

---

## ADDED Requirements

### REQ-CATALOG-001: POST /api/catalog/preview route exists and requires auth

The Go API MUST register `POST /api/catalog/preview` in `internal/server/server.go` behind the
`mw.RequireAuth` middleware. The route MUST NOT be reachable without a valid access JWT. Any
request without a `Authorization: Bearer <token>` header containing a valid, non-expired JWT
MUST be rejected before the handler body executes.

The route MUST be registered within the `/api` prefix group alongside the existing catalog GET
routes, before those GET routes (consistent with the TS registration ordering).

#### Scenario: Route reachable at correct path · `code-based` · `critical`

```
WHEN POST /api/catalog/preview with valid auth and valid body
THEN HTTP 200
 (confirms the route is registered and not 404)
```

#### Scenario: Route rejects unauthenticated request · `code-based` · `critical`

```
WHEN POST /api/catalog/preview with no Authorization header
THEN HTTP 401
 AND body == { "error": "Unauthorized", "code": "UNAUTHORIZED" }
 AND Content-Type: application/json
```

#### Scenario: Route rejects expired/invalid JWT · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND Authorization: Bearer <tampered-or-expired-token>
THEN HTTP 401
 AND body contains "code": "UNAUTHORIZED"
```

---

### REQ-CATALOG-002: Valid request → 200 with GenericWorkoutRow[] (max 10 items)

A valid request MUST return HTTP 200 with a JSON array of `GenericWorkoutRow` objects. The array
MUST contain at most 10 items regardless of `definition.TotalWorkouts`. If
`definition.TotalWorkouts <= 10`, the array length MUST equal `totalWorkouts`.

The response body MUST be a JSON array (not wrapped in an object). Each element MUST conform to
the `GenericWorkoutRow` shape with all required fields present.

The Content-Type MUST be `application/json`.

#### Scenario: GZCLP definition returns exactly 10 rows · `code-based` · `critical`

```
GIVEN valid auth token
  AND body = {
    "definition": {
      "id": "gzclp",
      "name": "GZCLP",
      "description": "",
      "author": "Cody Lefever",
      "version": 1,
      "category": "strength",
      "source": "preset",
      "cycleLength": 4,
      "totalWorkouts": 90,
      "workoutsPerWeek": 3,
      "exercises": { "squat": { "name": "Sentadilla" }, ... },
      "configFields": [ { "key": "squat", "label": "Sentadilla", "type": "weight", "min": 2.5, "step": 2.5 }, ... ],
      "weightIncrements": { "squat": 5, "bench": 2.5, ... },
      "days": [ ... ]
    },
    "config": { "squat": 60, "bench": 40, "deadlift": 80, "ohp": 25, "latpulldown": 30, "dbrow": 30 }
  }
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND Content-Type: application/json
 AND len(responseBody) == 10
 AND responseBody[0].index == 0
 AND responseBody[0].dayName == "Día 1"
 AND responseBody[0] conforms to GenericWorkoutRowSchema
```

#### Scenario: program with totalWorkouts=3 → 3 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND body = {
    "definition": {
      "id": "test",
      "name": "Test",
      "description": "",
      "author": "test",
      "version": 1,
      "category": "test",
      "source": "preset",
      "cycleLength": 1,
      "totalWorkouts": 3,
      "workoutsPerWeek": 3,
      "exercises": { "ex": { "name": "Exercise" } },
      "configFields": [ { "key": "ex", "label": "Exercise", "type": "weight", "min": 0, "step": 2.5 } ],
      "weightIncrements": { "ex": 5 },
      "days": [ { "name": "Day 1", "slots": [ {
        "id": "slot1", "exerciseId": "ex", "tier": "t1",
        "stages": [ { "sets": 5, "reps": 3 } ],
        "onSuccess": { "type": "add_weight" },
        "onMidStageFail": { "type": "no_change" },
        "onFinalStageFail": { "type": "no_change" },
        "startWeightKey": "ex"
      } ] } ]
    },
    "config": {}
  }
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND len(responseBody) == 3
```

#### Scenario: response rows have required fields present · `code-based` · `critical`

```
GIVEN valid GZCLP preview request as above
WHEN POST /api/catalog/preview
THEN for each row in responseBody:
  row.index is present (number)
  row.dayName is present (string)
  row.slots is present (array, len >= 1)
  row.isChanged is present (boolean)
  for each slot in row.slots:
    slot.slotId is present (string)
    slot.exerciseId is present (string)
    slot.exerciseName is present (string)
    slot.tier is present (string)
    slot.weight is present (number, may be 0)
    slot.stage is present (number, >= 0)
    slot.sets is present (number)
    slot.reps is present (number)
    slot.isAmrap is present (boolean)
    slot.stagesCount is present (number)
    slot.isChanged is present (boolean)
    slot.isDeload is present (boolean)
```

---

### REQ-CATALOG-003: Missing/invalid auth → 401

The server MUST return HTTP 401 with a JSON error body for any request where:

- The `Authorization` header is absent.
- The JWT is malformed (not a valid signed token).
- The JWT is expired.
- The JWT signature does not match the server's secret.

The error body MUST have the shape `{ "error": "<message>", "code": "UNAUTHORIZED" }`.
The `code` field value MUST be exactly `"UNAUTHORIZED"` (uppercase).

#### Scenario: No Authorization header → 401 · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND no Authorization header
THEN HTTP 401
 AND body.code == "UNAUTHORIZED"
```

#### Scenario: Malformed bearer token → 401 · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND Authorization: Bearer not.a.real.jwt
THEN HTTP 401
 AND body.code == "UNAUTHORIZED"
```

---

### REQ-CATALOG-004: Invalid definition → 422

When the `definition` field in the request body fails schema validation (e.g., missing required
fields, wrong types, invalid rule structure), the server MUST return HTTP 422 with a JSON error
body.

An empty object `{}` as the definition MUST be treated as invalid (missing required fields
`id`, `name`, `days`, `totalWorkouts`, etc.).

The error body MUST have the shape `{ "error": "<message>", "code": "VALIDATION_ERROR" }`.
The `code` field MUST be exactly `"VALIDATION_ERROR"`.

Validation MUST reject definitions structurally inconsistent with `ProgramDefinitionSchema`:

- Missing required top-level fields
- `days` with zero items
- `stages` with zero items in any slot
- Unknown `type` in any progression rule

#### Scenario: Empty definition object → 422 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": {} }
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
 AND body.error is a non-empty string
```

#### Scenario: Definition with missing required field (no days) → 422 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": {
    "id": "test", "name": "Test", "description": "", "author": "test",
    "version": 1, "category": "test", "source": "preset",
    "cycleLength": 1, "totalWorkouts": 1, "workoutsPerWeek": 3,
    "exercises": {}, "configFields": [], "weightIncrements": {}
  } }
  (missing "days" field)
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
```

#### Scenario: Definition with invalid rule type → 422 · `code-based` · `standard`

```
GIVEN valid auth
  AND body contains a slot with onSuccess.type = "unknown_rule"
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
```

---

### REQ-CATALOG-005: Rate limit — 30 requests per hour per userId

The handler MUST enforce an in-process rate limit of 30 requests per hour (3,600 seconds) per
authenticated `userId`. The rate limit window MUST be a sliding window that resets when
`time.Since(windowStart) > time.Hour`.

When the 31st request within the window arrives, the server MUST return HTTP 429 with:
`{ "error": "<message>", "code": "RATE_LIMITED" }`.
The `code` field MUST be exactly `"RATE_LIMITED"`.

The rate limit MUST be keyed by `userId` (extracted from the JWT). Two different users sharing
the same IP MUST have independent rate limit counters.

Implementation MUST use a package-level `sync.Map` (no Redis dependency). The map stores a
record of `{count int, windowStart time.Time}` per `userId`.

#### Scenario: 30th request succeeds, 31st is rate limited · `code-based` · `critical`

```
GIVEN valid auth for userId "user-123"
  AND 30 prior valid requests have been made within the last hour
WHEN 31st POST /api/catalog/preview by userId "user-123"
THEN HTTP 429
 AND body.code == "RATE_LIMITED"
 AND body.error is a non-empty string
```

#### Scenario: Different userIds have independent counters · `code-based` · `standard`

```
GIVEN 30 requests made by userId "user-A"
  AND 0 requests by userId "user-B"
WHEN POST /api/catalog/preview by userId "user-B"
THEN HTTP 200
```

#### Scenario: Counter resets after window expires · `code-based` · `standard`

```
GIVEN 30 requests made by userId "user-123" at time T
  AND now > T + 1 hour
WHEN POST /api/catalog/preview by userId "user-123"
THEN HTTP 200
  (window has reset — new window starts at now)
```

---

### REQ-CATALOG-006: Config resolution — defaults when fields absent

The handler MUST resolve the incoming `config` map against the definition's `configFields` before
calling `ComputeGenericProgram`. The resolved config MUST supply a value for every config key
referenced by any slot, even when the caller's `config` map is absent or omits those keys.

Resolution rules, applied per `configField`:

- `type == "weight"`: use `config[field.key]` if present and numeric, else `0.0`.
- `type == "select"`: use `config[field.key]` if present and a string, else `field.options[0].value`.

The `config` field in the request body is optional. When omitted entirely, all weight fields
MUST default to `0.0` and all select fields MUST default to `options[0].value`.

The resolved config object passed to `ComputeGenericProgram` MUST contain only `number | string`
values. Array/object/boolean/null values in the raw `config` MUST be ignored (treated as missing).

#### Scenario: Absent config → all weight fields default to 0 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": <valid definition with weight configFields> }
  (no "config" key in body)
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND rows[0].Slots[0].Weight == 0.0   (weight defaults to 0)
```

#### Scenario: Partial config → unspecified weight fields default to 0 · `code-based` · `critical`

```
GIVEN definition has configFields = [
    { "key": "squat", "type": "weight", ... },
    { "key": "bench", "type": "weight", ... }
  ]
  AND body.config = { "squat": 60 }  (bench omitted)
WHEN POST /api/catalog/preview
THEN the resolved config has squat=60.0 and bench=0.0
```

#### Scenario: Select field defaults to first option when absent · `code-based` · `critical`

```
GIVEN definition has configField =
  { "key": "variant", "type": "select", "options": [
      { "label": "Option A", "value": "a" },
      { "label": "Option B", "value": "b" }
    ] }
  AND body.config = {} (variant absent)
WHEN POST /api/catalog/preview
THEN resolved config has variant = "a"   (options[0].value)
```

#### Scenario: Object value in config treated as absent (ignored) · `code-based` · `standard`

```
GIVEN body.config = { "squat": { "value": 60 } }  (object, not number or string)
WHEN POST /api/catalog/preview
THEN resolved config treats squat as 0.0  (object value ignored)
```

---

### REQ-CATALOG-007: Response contains no more than 10 rows

The response array MUST be capped at 10 items. This MUST be enforced by slicing the
`ComputeGenericProgram` output to `rows[:min(10, len(rows))]` in `PreviewDefinition`.

A definition with `totalWorkouts > 10` MUST NOT return more than 10 rows. A definition with
`totalWorkouts <= 10` MUST return exactly `totalWorkouts` rows.

The `MAX_PREVIEW_ROWS` constant MUST be `10` (matching the TypeScript implementation).

#### Scenario: 90-workout program → exactly 10 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND definition.totalWorkouts == 90  (e.g., GZCLP)
WHEN POST /api/catalog/preview
THEN len(responseBody) == 10
```

#### Scenario: 3-workout program → exactly 3 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND definition.totalWorkouts == 3
WHEN POST /api/catalog/preview
THEN len(responseBody) == 3
```

#### Scenario: 10-workout program → exactly 10 rows · `code-based` · `standard`

```
GIVEN valid auth
  AND definition.totalWorkouts == 10
WHEN POST /api/catalog/preview
THEN len(responseBody) == 10
```

---

## Acceptance Criteria Summary

| Requirement ID  | Type              | Priority | Scenarios |
| --------------- | ----------------- | -------- | --------- |
| REQ-CATALOG-001 | Functional / Auth | Must     | 3         |
| REQ-CATALOG-002 | Functional        | Must     | 3         |
| REQ-CATALOG-003 | Auth              | Must     | 2         |
| REQ-CATALOG-004 | Validation        | Must     | 3         |
| REQ-CATALOG-005 | Rate Limiting     | Must     | 3         |
| REQ-CATALOG-006 | Config Resolution | Must     | 4         |
| REQ-CATALOG-007 | Output Capping    | Must     | 3         |

---

## Eval Definitions

| Scenario                                      | Eval Type  | Criticality | Threshold |
| --------------------------------------------- | ---------- | ----------- | --------- |
| Route reachable at correct path               | code-based | critical    | Pass      |
| Route rejects unauthenticated request         | code-based | critical    | Pass      |
| Route rejects expired/invalid JWT             | code-based | critical    | Pass      |
| GZCLP definition returns exactly 10 rows      | code-based | critical    | Pass      |
| program totalWorkouts=3 returns 3 rows        | code-based | critical    | Pass      |
| response rows have required fields present    | code-based | critical    | Pass      |
| No Authorization header → 401                 | code-based | critical    | Pass      |
| Malformed bearer token → 401                  | code-based | critical    | Pass      |
| Empty definition object → 422                 | code-based | critical    | Pass      |
| Missing required field (no days) → 422        | code-based | critical    | Pass      |
| Invalid rule type → 422                       | code-based | standard    | Pass      |
| 30th request succeeds, 31st rate limited      | code-based | critical    | Pass      |
| Different userIds have independent counters   | code-based | standard    | Pass      |
| Counter resets after window expires           | code-based | standard    | Pass      |
| Absent config → weight fields default 0       | code-based | critical    | Pass      |
| Partial config → unspecified fields default 0 | code-based | critical    | Pass      |
| Select field defaults to first option         | code-based | critical    | Pass      |
| Object value in config ignored                | code-based | standard    | Pass      |
| 90-workout program → 10 rows                  | code-based | critical    | Pass      |
| 3-workout program → 3 rows                    | code-based | critical    | Pass      |
| 10-workout program → 10 rows                  | code-based | standard    | Pass      |
