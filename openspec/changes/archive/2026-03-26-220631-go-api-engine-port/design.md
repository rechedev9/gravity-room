---
summary: Design for porting the TypeScript progression engine to Go and wiring POST /api/catalog/preview
read_when: implementing go-api-engine-port
---

# Design: go-api-engine-port

Port `computeGenericProgram`, `extractAllGenericStats`, graduation helpers, and `hydrateProgramDefinition` to Go as `internal/engine`, then wire a new authenticated `POST /api/catalog/preview` endpoint.

---

## 1. Architecture Overview

### Package placement

The engine lives entirely in `internal/engine/`. It has **no imports from any other internal package** — no `apierror`, no `model`, no `service`, no `db`. It depends only on Go stdlib (`math`, `strconv`, `sync`, `time`, `encoding/json`, `fmt`).

```
internal/
  engine/          ← new package (pure computation, no I/O)
    types.go
    engine.go
    stats.go
    graduation.go
    hydrate.go
    engine_test.go
    testdata/
      gzclp.json
  handler/
    catalog.go     ← modified: add HandlePreview
  service/
    catalog.go     ← modified: add PreviewDefinition + rate limiter state
  server/
    server.go      ← modified: register POST /catalog/preview route
```

### Data flow

```
POST /api/catalog/preview
  → mw.RequireAuth          (extracts userID from JWT, 401 if absent)
  → CatalogHandler.HandlePreview
      decode body → engine.ProgramDefinition + config map
      validateDefinition(def) → 422 if invalid
      checkPreviewRateLimit(userID) → 429 if over limit
      service.PreviewDefinition(def, config)
        → engine.ComputeGenericProgram(def, config, empty results)
        → []engine.GenericWorkoutRow
      json.NewEncoder(w).Encode(rows)
```

### Dependency graph

```
server      → handler
handler     → service, engine, middleware, apierror, logging
service     → engine (for PreviewDefinition)
engine      → (stdlib only)
model       → (unchanged; engine types are not model types)
```

Engine types (`GenericWorkoutRow`, `GenericSlotRow`, etc.) are defined inside `internal/engine/types.go` and returned directly from the handler — they are not redeclared in `internal/model/`. This keeps the contract tight: the JSON produced by the handler exactly matches the Go struct tags in `engine/types.go`.

---

## 2. File Structure

| Path                                  | Action | Purpose                                                                                                                                                             |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internal/engine/types.go`            | Create | All Go struct definitions for engine I/O                                                                                                                            |
| `internal/engine/engine.go`           | Create | `ComputeGenericProgram` + helpers (`roundToNearest`, `roundToNearestHalf`, `configToNum`, `deriveSlotResult`, `applyRule`, `applyUpdateTm`, `applySlotProgression`) |
| `internal/engine/stats.go`            | Create | `ExtractAllGenericStats`, `FormatDateLabel`, `computeSlotVolume`                                                                                                    |
| `internal/engine/graduation.go`       | Create | `ComputeGraduationTargets`, `CheckGraduationCriterion`, `ComputeEpley1RM`, `SuggestNextWeight`                                                                      |
| `internal/engine/hydrate.go`          | Create | `HydrateProgramDefinition` — merges template row + exercise rows into a `ProgramDefinition`                                                                         |
| `internal/engine/engine_test.go`      | Create | Table-driven unit tests for all rule types, rounding, hydration, stats, graduation                                                                                  |
| `internal/engine/testdata/gzclp.json` | Create | Static GZCLP definition fixture (derived from `apps/api/src/db/seeds/programs/gzclp.ts`)                                                                            |
| `internal/handler/catalog.go`         | Modify | Add `HandlePreview` method on `CatalogHandler`                                                                                                                      |
| `internal/service/catalog.go`         | Modify | Add `PreviewDefinition` function + `previewRateLimiter` `sync.Map`                                                                                                  |
| `internal/server/server.go`           | Modify | Register `POST /catalog/preview` before existing catalog GET routes                                                                                                 |

---

## 3. Data Structures

All types live in `internal/engine/types.go`.

### Progression rules

```go
// ProgressionRule is a discriminated union on Type.
// Optional fields are nil when not applicable to the rule type.
type ProgressionRule struct {
    Type           string   `json:"type"`
    Percent        *float64 `json:"percent,omitempty"`        // deload_percent
    Amount         *float64 `json:"amount,omitempty"`         // add_weight_reset_stage, update_tm
    MinAmrapReps   *int     `json:"minAmrapReps,omitempty"`   // update_tm
    RepRangeTop    *int     `json:"repRangeTop,omitempty"`    // double_progression
    RepRangeBottom *int     `json:"repRangeBottom,omitempty"` // double_progression
}
```

Valid `Type` values: `"add_weight"`, `"advance_stage"`, `"advance_stage_add_weight"`, `"deload_percent"`, `"add_weight_reset_stage"`, `"no_change"`, `"update_tm"`, `"double_progression"`.

### StageDefinition

```go
type StageDefinition struct {
    Sets    int  `json:"sets"`
    Reps    int  `json:"reps"`
    Amrap   bool `json:"amrap,omitempty"` // omit when false
    RepsMax *int `json:"repsMax,omitempty"`
}
```

### SetPrescription

```go
// SetPrescription is a single percentage-based set prescription.
type SetPrescription struct {
    Percent float64 `json:"percent"`
    Reps    int     `json:"reps"`
    Sets    int     `json:"sets"`
}
```

### ExerciseSlot

```go
type ExerciseSlot struct {
    ID                   string           `json:"id"`
    ExerciseID           string           `json:"exerciseId"`
    Tier                 string           `json:"tier"`
    Stages               []StageDefinition `json:"stages"`
    OnSuccess            ProgressionRule  `json:"onSuccess"`
    OnFinalStageSuccess  *ProgressionRule `json:"onFinalStageSuccess,omitempty"`
    OnUndefined          *ProgressionRule `json:"onUndefined,omitempty"`
    OnMidStageFail       ProgressionRule  `json:"onMidStageFail"`
    OnFinalStageFail     ProgressionRule  `json:"onFinalStageFail"`
    StartWeightKey       string           `json:"startWeightKey"`
    StartWeightMultiplier *float64        `json:"startWeightMultiplier,omitempty"`
    StartWeightOffset    *int             `json:"startWeightOffset,omitempty"`
    TrainingMaxKey       *string          `json:"trainingMaxKey,omitempty"`
    TmPercent            *float64         `json:"tmPercent,omitempty"`
    Role                 *string          `json:"role,omitempty"`
    Notes                *string          `json:"notes,omitempty"`
    Prescriptions        []SetPrescription `json:"prescriptions,omitempty"`
    PercentOf            *string          `json:"percentOf,omitempty"`
    IsGpp                *bool            `json:"isGpp,omitempty"`
    ComplexReps          *string          `json:"complexReps,omitempty"`
    PropagatesTo         *string          `json:"propagatesTo,omitempty"`
    IsTestSlot           *bool            `json:"isTestSlot,omitempty"`
    IsBodyweight         *bool            `json:"isBodyweight,omitempty"`
    ProgressionSetIndex  *int             `json:"progressionSetIndex,omitempty"`
}
```

### ProgramDay

```go
type ProgramDay struct {
    Name  string        `json:"name"`
    Slots []ExerciseSlot `json:"slots"`
}
```

### SelectOption and ConfigField

```go
type SelectOption struct {
    Label string `json:"label"`
    Value string `json:"value"`
}

// ConfigField is a discriminated union on Type: "weight" or "select".
type ConfigField struct {
    Key          string         `json:"key"`
    Label        string         `json:"label"`
    Type         string         `json:"type"`
    // weight fields
    Min          *float64       `json:"min,omitempty"`
    Step         *float64       `json:"step,omitempty"`
    Group        *string        `json:"group,omitempty"`
    Hint         *string        `json:"hint,omitempty"`
    GroupHint    *string        `json:"groupHint,omitempty"`
    // select fields
    Options      []SelectOption `json:"options,omitempty"`
}
```

### ProgramDefinition

```go
type ProgramDefinition struct {
    ID                   string                    `json:"id"`
    Name                 string                    `json:"name"`
    Description          string                    `json:"description"`
    Author               string                    `json:"author"`
    Version              int                       `json:"version"`
    Category             string                    `json:"category"`
    Source               string                    `json:"source"`
    Days                 []ProgramDay              `json:"days"`
    CycleLength          int                       `json:"cycleLength"`
    TotalWorkouts        int                       `json:"totalWorkouts"`
    WorkoutsPerWeek      int                       `json:"workoutsPerWeek"`
    Exercises            map[string]ExerciseEntry  `json:"exercises"`
    ConfigFields         []ConfigField             `json:"configFields"`
    WeightIncrements     map[string]float64        `json:"weightIncrements"`
    ConfigTitle          *string                   `json:"configTitle,omitempty"`
    ConfigDescription    *string                   `json:"configDescription,omitempty"`
    ConfigEditTitle      *string                   `json:"configEditTitle,omitempty"`
    ConfigEditDescription *string                  `json:"configEditDescription,omitempty"`
    DisplayMode          *string                   `json:"displayMode,omitempty"`
}

// ExerciseEntry is the value type in ProgramDefinition.Exercises.
type ExerciseEntry struct {
    Name string `json:"name"`
}
```

### SetLog and SlotResult (engine-internal input types)

```go
// SetLogEntry is a per-set recorded data point from the client.
type SetLogEntry struct {
    Reps   int      `json:"reps"`
    Weight *float64 `json:"weight,omitempty"`
    Rpe    *float64 `json:"rpe,omitempty"`
}

// SlotResult is the recorded result for one slot in one workout.
type SlotResult struct {
    Result    *string       `json:"result,omitempty"`    // "success" | "fail" | nil
    AmrapReps *int          `json:"amrapReps,omitempty"`
    Rpe       *float64      `json:"rpe,omitempty"`
    SetLogs   []SetLogEntry `json:"setLogs,omitempty"`
}

// GenericResults is keyed by workout index string ("0", "1", …),
// then by slot ID.
type GenericResults map[string]map[string]SlotResult
```

### ResolvedPrescription

```go
// ResolvedPrescription is an element of the output prescriptions ladder.
type ResolvedPrescription struct {
    Percent float64 `json:"percent"`
    Reps    int     `json:"reps"`
    Sets    int     `json:"sets"`
    Weight  float64 `json:"weight"`
}
```

### GenericSlotRow (output)

Required fields (`weight`, `stage`, `sets`, `reps`, `isAmrap`, `stagesCount`, `isChanged`, `isDeload`) MUST NOT have `omitempty` — they always serialize even when zero/false. Optional fields use pointer + `omitempty`.

```go
type GenericSlotRow struct {
    SlotID        string                 `json:"slotId"`
    ExerciseID    string                 `json:"exerciseId"`
    ExerciseName  string                 `json:"exerciseName"`
    Tier          string                 `json:"tier"`
    Weight        float64               `json:"weight"`       // NO omitempty
    Stage         int                   `json:"stage"`        // NO omitempty
    Sets          int                   `json:"sets"`         // NO omitempty
    Reps          int                   `json:"reps"`         // NO omitempty
    IsAmrap       bool                  `json:"isAmrap"`      // NO omitempty
    StagesCount   int                   `json:"stagesCount"`  // NO omitempty
    IsChanged     bool                  `json:"isChanged"`    // NO omitempty
    IsDeload      bool                  `json:"isDeload"`     // NO omitempty
    Result        *string               `json:"result,omitempty"`
    AmrapReps     *int                  `json:"amrapReps,omitempty"`
    Rpe           *float64              `json:"rpe,omitempty"`
    RepsMax       *int                  `json:"repsMax,omitempty"`
    Role          *string               `json:"role,omitempty"`
    Notes         *string               `json:"notes,omitempty"`
    Prescriptions []ResolvedPrescription `json:"prescriptions,omitempty"`
    IsGpp         *bool                 `json:"isGpp,omitempty"`
    ComplexReps   *string               `json:"complexReps,omitempty"`
    PropagatesTo  *string               `json:"propagatesTo,omitempty"`
    IsTestSlot    *bool                 `json:"isTestSlot,omitempty"`
    IsBodyweight  *bool                 `json:"isBodyweight,omitempty"`
    SetLogs       []SetLogEntry         `json:"setLogs,omitempty"`
}
```

### GenericWorkoutRow (output)

```go
type GenericWorkoutRow struct {
    Index       int              `json:"index"`
    DayName     string           `json:"dayName"`
    Slots       []GenericSlotRow `json:"slots"`
    IsChanged   bool             `json:"isChanged"` // NO omitempty
    CompletedAt *string          `json:"completedAt,omitempty"`
}
```

### Stats output types

```go
type ChartDataPoint struct {
    Workout   int     `json:"workout"`
    Weight    float64 `json:"weight"`
    Stage     int     `json:"stage"`
    Result    *string `json:"result"` // null (not omitted) when no result — keep pointer, omit omitempty
    Date      *string `json:"date,omitempty"`
    AmrapReps *int    `json:"amrapReps,omitempty"`
}

type RpeDataPoint struct {
    Workout int     `json:"workout"`
    Rpe     float64 `json:"rpe"`
    Date    *string `json:"date,omitempty"`
}

type AmrapDataPoint struct {
    Workout int     `json:"workout"`
    Reps    int     `json:"reps"`
    Weight  float64 `json:"weight"`
    Date    *string `json:"date,omitempty"`
}

type VolumeDataPoint struct {
    Workout   int     `json:"workout"`
    VolumeKg  int     `json:"volumeKg"`
    Date      *string `json:"date,omitempty"`
}

type AllGenericStats struct {
    ChartData  map[string][]ChartDataPoint  `json:"chartData"`
    RpeData    map[string][]RpeDataPoint    `json:"rpeData"`
    AmrapData  map[string][]AmrapDataPoint  `json:"amrapData"`
    VolumeData []VolumeDataPoint            `json:"volumeData"`
}
```

**Note on `ChartDataPoint.Result`:** The TS type is `ResultValue | null` (never `undefined`). In Go, use `*string` without `omitempty`. When no result, it serializes as `null` (JSON null), not omitted.

### Graduation types

```go
type GraduationTarget struct {
    Exercise      string  `json:"exercise"`
    TargetWeight  float64 `json:"targetWeight"`
    RequiredReps  int     `json:"requiredReps"`
    Description   string  `json:"description"`
}

type GraduationState struct {
    Squat     bool `json:"squat"`
    Bench     bool `json:"bench"`
    Deadlift  bool `json:"deadlift"`
    AllPassed bool `json:"allPassed"`
}

type GraduationStatus struct {
    Targets          []GraduationTarget        `json:"targets"`
    Achieved         GraduationState           `json:"achieved"`
    EstimatedOneRMs  map[string]float64        `json:"estimatedOneRMs"` // null when nil
}
```

### Hydration types (internal/engine/hydrate.go)

```go
// TemplateRow is the DB row shape passed into HydrateProgramDefinition.
type TemplateRow struct {
    ID          string
    Name        string
    Description string
    Author      string
    Version     int
    Category    string
    Source      string
    Definition  json.RawMessage // JSONB bytes from DB
}

// ExerciseRow is a minimal exercise record needed for name resolution.
type ExerciseRow struct {
    ID   string
    Name string
}

// HydrationError codes
const (
    HydrationErrInvalidDefinition    = "INVALID_DEFINITION"
    HydrationErrMissingExercise      = "MISSING_EXERCISE_REFERENCE"
    HydrationErrSchemaValidation     = "SCHEMA_VALIDATION_FAILED"
)

type HydrationError struct {
    Code       string
    ExerciseID string // populated for MISSING_EXERCISE_REFERENCE
    Message    string // populated for INVALID_DEFINITION and SCHEMA_VALIDATION_FAILED
}

func (e *HydrationError) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }
```

---

## 4. Key Algorithms

### `internal/engine/engine.go`

#### RoundToNearestHalf

```go
func RoundToNearestHalf(value float64) float64 {
    rounded := math.Round(value*2) / 2
    if !math.IsFinite(rounded) || rounded < 0 {
        return 0
    }
    return rounded
}
```

#### RoundToNearest

The TS formula is:

```ts
Math.round(Math.round(value / step) * step * 1000) / 1000;
```

Wait — re-reading the source at line 19-22 of `generic-engine.ts`:

```ts
const rounded = Math.round(value / step) * step;
if (!Number.isFinite(rounded) || rounded < 0) return 0;
return Math.round(rounded * 1000) / 1000;
```

The outer `Math.round(rounded * 1000) / 1000` removes floating-point artifacts (e.g., `67.499...` → `67.5`). The spec prompt described a different formula — the actual TS is the above. Go translation:

```go
func RoundToNearest(value, step float64) float64 {
    if step <= 0 || math.IsInf(step, 0) || math.IsNaN(step) {
        return RoundToNearestHalf(value)
    }
    rounded := math.Round(value/step) * step
    if !math.IsFinite(rounded) || rounded < 0 {
        return 0
    }
    // Remove floating-point artifacts
    return math.Round(rounded*1000) / 1000
}
```

#### ConfigToNum

```go
func configToNum(config map[string]any, key string) float64 {
    v, ok := config[key]
    if !ok {
        return 0
    }
    switch val := v.(type) {
    case float64:
        return val
    case string:
        f, err := strconv.ParseFloat(val, 64)
        if err != nil || !math.IsFinite(f) {
            return 0
        }
        return f
    default:
        return 0
    }
}
```

JSON `Unmarshal` into `map[string]any` always represents numbers as `float64`, so the `float64` case handles numeric config values. The `string` case handles select field values that may also appear in config (e.g., rounding step stored as string).

#### Config resolution for the preview endpoint

When `config` is supplied by the preview caller, it may omit keys. Resolution rules:

- `weight` type config fields: missing key → 0 (via `configToNum` default)
- `select` type config fields: missing key → `options[0].value` (first option)

This resolution happens in `service.PreviewDefinition` before calling the engine, not inside the engine itself. The service builds a resolved `map[string]any` by iterating `def.ConfigFields`.

```go
func resolveConfig(def engine.ProgramDefinition, raw map[string]any) map[string]any {
    resolved := make(map[string]any, len(raw))
    for k, v := range raw {
        resolved[k] = v
    }
    for _, field := range def.ConfigFields {
        if _, exists := resolved[field.Key]; !exists {
            if field.Type == "select" && len(field.Options) > 0 {
                resolved[field.Key] = field.Options[0].Value
            }
            // weight fields default to 0 — configToNum handles missing keys
        }
    }
    return resolved
}
```

#### slotState initialization

```go
type slotState struct {
    weight     float64
    stage      int
    everChanged bool
}

// One entry per unique slot.ID (slots shared across days are initialized once)
states := make(map[string]slotState)
for _, day := range def.Days {
    for _, slot := range day.Slots {
        if _, seen := states[slot.ID]; seen {
            continue
        }
        base := configToNum(config, slot.StartWeightKey)
        multiplied := base
        if slot.StartWeightMultiplier != nil {
            multiplied = RoundToNearest(base * *slot.StartWeightMultiplier, roundingStep)
        }
        offset := 0
        if slot.StartWeightOffset != nil {
            offset = *slot.StartWeightOffset
        }
        increment := def.WeightIncrements[slot.ExerciseID] // 0 if missing
        weight := RoundToNearest(multiplied - float64(offset)*increment, roundingStep)
        states[slot.ID] = slotState{weight: weight, stage: 0, everChanged: false}
    }
}
```

#### tmState initialization

```go
tmState := make(map[string]float64)
for _, day := range def.Days {
    for _, slot := range day.Slots {
        if slot.TrainingMaxKey != nil {
            if _, seen := tmState[*slot.TrainingMaxKey]; !seen {
                tmState[*slot.TrainingMaxKey] = configToNum(config, *slot.TrainingMaxKey)
            }
        }
    }
}
```

#### deriveSlotResult

```go
// deriveSlotResult derives the effective result for a slot by checking setLogs
// against the slot's onSuccess rule type.
func deriveSlotResult(slot ExerciseSlot, sr SlotResult, targetReps int) *string {
    if len(sr.SetLogs) == 0 {
        return sr.Result
    }

    // When progressionSetIndex is set, only that set determines progression
    logs := sr.SetLogs
    if slot.ProgressionSetIndex != nil && *slot.ProgressionSetIndex < len(logs) {
        logs = logs[*slot.ProgressionSetIndex : *slot.ProgressionSetIndex+1]
    }

    if slot.OnSuccess.Type == "double_progression" {
        top := *slot.OnSuccess.RepRangeTop
        bot := *slot.OnSuccess.RepRangeBottom
        derived := deriveResultFromSetLogs(logs, top, bot)
        if derived != nil {
            return derived
        }
        return sr.Result
    }

    derived := deriveResultFromSetLogsSimple(logs, targetReps)
    if derived != nil {
        return derived
    }
    return sr.Result
}

func deriveResultFromSetLogs(logs []SetLogEntry, top, bottom int) *string {
    allGte := true
    anyLt := false
    for _, s := range logs {
        if s.Reps < top {
            allGte = false
        }
        if s.Reps < bottom {
            anyLt = true
        }
    }
    if allGte {
        s := "success"
        return &s
    }
    if anyLt {
        s := "fail"
        return &s
    }
    return nil
}

func deriveResultFromSetLogsSimple(logs []SetLogEntry, targetReps int) *string {
    allGte := true
    for _, s := range logs {
        if s.Reps < targetReps {
            allGte = false
            break
        }
    }
    if allGte {
        s := "success"
        return &s
    }
    s := "fail"
    return &s
}
```

#### applyRule

```go
func applyRule(rule ProgressionRule, st slotState, increment float64, maxStageIdx int, roundingStep float64) slotState {
    switch rule.Type {
    case "add_weight":
        return slotState{weight: st.weight + increment, stage: st.stage, everChanged: st.everChanged}
    case "advance_stage":
        next := st.stage + 1
        if next > maxStageIdx {
            next = maxStageIdx
        }
        return slotState{weight: st.weight, stage: next, everChanged: st.everChanged}
    case "advance_stage_add_weight":
        next := st.stage + 1
        if next > maxStageIdx {
            next = maxStageIdx
        }
        return slotState{weight: st.weight + increment, stage: next, everChanged: st.everChanged}
    case "deload_percent":
        pct := *rule.Percent
        newW := RoundToNearest(st.weight*(1-pct/100), roundingStep)
        return slotState{weight: newW, stage: 0, everChanged: st.everChanged}
    case "add_weight_reset_stage":
        newW := RoundToNearest(st.weight + *rule.Amount, roundingStep)
        return slotState{weight: newW, stage: 0, everChanged: st.everChanged}
    case "no_change":
        return st
    case "update_tm":
        // Handled inline in applySlotProgression (needs tmState access). Defensive no-op.
        return st
    case "double_progression":
        return slotState{weight: st.weight + increment, stage: st.stage, everChanged: st.everChanged}
    default:
        return st
    }
}
```

#### applyUpdateTm

```go
func applyUpdateTm(
    rule ProgressionRule,
    slot ExerciseSlot,
    sr SlotResult,
    tmState map[string]float64,
    states map[string]slotState,
    st slotState,
    roundingStep float64,
) {
    // trainingMaxKey guaranteed non-nil (validation enforces it)
    key := *slot.TrainingMaxKey
    if sr.AmrapReps != nil && *sr.AmrapReps >= *rule.MinAmrapReps {
        tmState[key] = RoundToNearest(tmState[key] + *rule.Amount, roundingStep)
        states[slot.ID] = slotState{weight: st.weight, stage: st.stage, everChanged: true}
    } else {
        states[slot.ID] = st // no change to everChanged
    }
}
```

#### applySlotProgression

```go
func applySlotProgression(
    slot ExerciseSlot,
    st slotState,
    sr SlotResult,
    resultValue *string,
    increment float64,
    tmState map[string]float64,
    states map[string]slotState,
    roundingStep float64,
) {
    maxStageIdx := len(slot.Stages) - 1

    if resultValue != nil && *resultValue == "fail" {
        var rule ProgressionRule
        if st.stage >= maxStageIdx {
            rule = slot.OnFinalStageFail
        } else {
            rule = slot.OnMidStageFail
        }
        if rule.Type == "update_tm" {
            applyUpdateTm(rule, slot, sr, tmState, states, st, roundingStep)
            return
        }
        changesState := rule.Type != "no_change"
        next := applyRule(rule, st, increment, maxStageIdx, roundingStep)
        ec := st.everChanged || changesState
        states[slot.ID] = slotState{weight: next.weight, stage: next.stage, everChanged: ec}
        return
    }

    if resultValue != nil && *resultValue == "success" {
        var rule ProgressionRule
        if st.stage >= maxStageIdx && slot.OnFinalStageSuccess != nil {
            rule = *slot.OnFinalStageSuccess
        } else {
            rule = slot.OnSuccess
        }
        if rule.Type == "update_tm" {
            applyUpdateTm(rule, slot, sr, tmState, states, st, roundingStep)
            return
        }
        next := applyRule(rule, st, increment, maxStageIdx, roundingStep)
        states[slot.ID] = slotState{weight: next.weight, stage: next.stage, everChanged: st.everChanged}
        return
    }

    // nil result — apply onUndefined if set, else onSuccess (implicit pass)
    rule := slot.OnSuccess
    if slot.OnUndefined != nil {
        rule = *slot.OnUndefined
    }
    if rule.Type == "update_tm" {
        applyUpdateTm(rule, slot, sr, tmState, states, st, roundingStep)
        return
    }
    next := applyRule(rule, st, increment, maxStageIdx, roundingStep)
    states[slot.ID] = slotState{weight: next.weight, stage: next.stage, everChanged: st.everChanged}
}
```

#### resolveRole

```go
var tierRoleMap = map[string]string{
    "t1": "primary",
    "t2": "secondary",
    "t3": "primary",
}

func resolveRole(explicitRole *string, tier string) *string {
    if explicitRole != nil {
        return explicitRole
    }
    if r, ok := tierRoleMap[tier]; ok {
        return &r
    }
    return nil
}
```

#### ComputeGenericProgram

```go
func ComputeGenericProgram(
    def ProgramDefinition,
    config map[string]any,
    results GenericResults,
) []GenericWorkoutRow {
    const defaultRoundingStep = 2.5
    roundingStep := configToNum(config, "rounding")
    if roundingStep == 0 {
        roundingStep = defaultRoundingStep
    }

    // Initialize slot states
    states := initSlotStates(def, config, roundingStep)
    tmState := initTmState(def, config)

    rows := make([]GenericWorkoutRow, 0, def.TotalWorkouts)
    cycleLen := len(def.Days)
    prevWeightByExercise := make(map[string]float64)

    for i := 0; i < def.TotalWorkouts; i++ {
        day := def.Days[i%cycleLen]
        workoutResult := results[strconv.Itoa(i)] // nil map is safe to read
        derivedBySlotID := make(map[string]*string)

        // Phase 1: snapshot current state → build slot rows
        slotRows := make([]GenericSlotRow, 0, len(day.Slots))
        for _, slot := range day.Slots {
            sr := workoutResult[slot.ID] // zero value if missing
            row := buildSlotRow(slot, sr, def, config, states, tmState, prevWeightByExercise, derivedBySlotID, roundingStep)
            slotRows = append(slotRows, row)
        }

        workoutIsChanged := false
        for _, sr := range slotRows {
            if sr.IsChanged {
                workoutIsChanged = true
                break
            }
        }

        rows = append(rows, GenericWorkoutRow{
            Index:       i,
            DayName:     day.Name,
            Slots:       slotRows,
            IsChanged:   workoutIsChanged,
            CompletedAt: nil,
        })

        // Phase 2: apply progression
        for _, slot := range day.Slots {
            if len(slot.Prescriptions) > 0 || (slot.IsGpp != nil && *slot.IsGpp) {
                continue
            }
            st := states[slot.ID]
            sr := workoutResult[slot.ID]
            resultValue := derivedBySlotID[slot.ID]
            increment := def.WeightIncrements[slot.ExerciseID]
            applySlotProgression(slot, st, sr, resultValue, increment, tmState, states, roundingStep)
        }
    }

    return rows
}
```

`buildSlotRow` encapsulates the three branching paths (prescription slot, GPP slot, standard stage slot) matching the TS `day.slots.map(...)` logic exactly:

- **Prescription slot** (`len(slot.Prescriptions) > 0 && slot.PercentOf != nil`): compute `base1rm` from config, build `resolvedPrescriptions`, use last entry as working set. Sets `isAmrap=false`, `stage=0`, `stagesCount=1`, `isChanged=false`, `isDeload=false`.
- **GPP slot** (`slot.IsGpp != nil && *slot.IsGpp`): use `stages[0]` for sets/reps, `weight=0`, `stage=0`, `stagesCount=1`, `isChanged=false`, `isDeload=false`, `isGpp=true`.
- **Standard slot**: use `states[slot.ID]` for weight/stage, resolve TM weight if applicable, compute `isDeload` from `prevWeightByExercise`, call `deriveSlotResult`, derive `amrapReps` from last setLog when `stageConfig.Amrap`.

### `internal/engine/stats.go`

#### FormatDateLabel

Go has no built-in `es-ES` locale Intl formatter. Replicate the TS output format:

- Same year: `"12 feb"` (day + abbreviated Spanish month, no comma)
- Prior year: `"12 feb 25"` (day + abbreviated Spanish month + 2-digit year)

```go
var spanishMonths = [12]string{
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
}

func FormatDateLabel(isoString string) *string {
    t, err := time.Parse(time.RFC3339, isoString)
    if err != nil {
        // Try date-only format
        t, err = time.Parse("2006-01-02", isoString)
        if err != nil {
            return nil
        }
    }
    now := time.Now()
    month := spanishMonths[t.Month()-1]
    var s string
    if t.Year() < now.Year() {
        s = fmt.Sprintf("%d %s %02d", t.Day(), month, t.Year()%100)
    } else {
        s = fmt.Sprintf("%d %s", t.Day(), month)
    }
    return &s
}
```

#### ExtractAllGenericStats

Single-pass over `rows`, accumulating into `chartData`, `rpeData`, `amrapData`, `volumeData`. Initializes per-exercise slice entries from `def.Exercises` keys first.

```go
func ExtractAllGenericStats(
    def ProgramDefinition,
    rows []GenericWorkoutRow,
    resultTimestamps map[string]string, // may be nil
) AllGenericStats {
    chartData := make(map[string][]ChartDataPoint, len(def.Exercises))
    rpeData := make(map[string][]RpeDataPoint, len(def.Exercises))
    amrapData := make(map[string][]AmrapDataPoint, len(def.Exercises))
    var volumeData []VolumeDataPoint

    for id := range def.Exercises {
        chartData[id] = []ChartDataPoint{}
        rpeData[id] = []RpeDataPoint{}
        amrapData[id] = []AmrapDataPoint{}
    }

    for _, row := range rows {
        idxStr := strconv.Itoa(row.Index)
        var date *string
        if ts, ok := resultTimestamps[idxStr]; ok {
            date = FormatDateLabel(ts)
        }
        workoutNum := row.Index + 1
        var volumeKg float64

        for _, slot := range row.Slots {
            stage := slot.Stage + 1
            chartData[slot.ExerciseID] = append(chartData[slot.ExerciseID], ChartDataPoint{
                Workout:   workoutNum,
                Weight:    slot.Weight,
                Stage:     stage,
                Result:    slot.Result,
                Date:      date,
                AmrapReps: slot.AmrapReps,
            })

            if slot.Rpe != nil {
                rpeData[slot.ExerciseID] = append(rpeData[slot.ExerciseID], RpeDataPoint{
                    Workout: workoutNum,
                    Rpe:     *slot.Rpe,
                    Date:    date,
                })
            }

            if slot.IsAmrap && slot.AmrapReps != nil && *slot.AmrapReps > 0 {
                amrapData[slot.ExerciseID] = append(amrapData[slot.ExerciseID], AmrapDataPoint{
                    Workout: workoutNum,
                    Reps:    *slot.AmrapReps,
                    Weight:  slot.Weight,
                    Date:    date,
                })
            }

            if slot.Result != nil && *slot.Result == "success" {
                volumeKg += computeSlotVolume(slot)
            }
        }

        if volumeKg > 0 {
            volumeData = append(volumeData, VolumeDataPoint{
                Workout:  workoutNum,
                VolumeKg: int(math.Round(volumeKg)),
                Date:     date,
            })
        }
    }

    return AllGenericStats{
        ChartData:  chartData,
        RpeData:    rpeData,
        AmrapData:  amrapData,
        VolumeData: volumeData,
    }
}

func computeSlotVolume(slot GenericSlotRow) float64 {
    if len(slot.SetLogs) > 0 {
        var sum float64
        for _, s := range slot.SetLogs {
            w := slot.Weight
            if s.Weight != nil {
                w = *s.Weight
            }
            sum += w * float64(s.Reps)
        }
        return sum
    }
    return slot.Weight * float64(slot.Sets) * float64(slot.Reps)
}
```

### `internal/engine/graduation.go`

Direct translation of the four TS functions; all call `RoundToNearest` from `engine.go`.

```go
func ComputeGraduationTargets(bodyweight float64, gender string, rounding float64) []GraduationTarget {
    multiplier := 1.0
    if gender == "female" {
        multiplier = 0.7
    }
    targetWeight := RoundToNearest(bodyweight*multiplier, rounding)
    return []GraduationTarget{
        {Exercise: "squat",    TargetWeight: targetWeight, RequiredReps: 3,  Description: fmt.Sprintf("3 reps @ %.4g kg (tempo 5-3-5)", targetWeight)},
        {Exercise: "bench",    TargetWeight: targetWeight, RequiredReps: 1,  Description: fmt.Sprintf("1 rep @ %.4g kg (tecnica perfecta)", targetWeight)},
        {Exercise: "deadlift", TargetWeight: targetWeight, RequiredReps: 10, Description: fmt.Sprintf("10 reps @ %.4g kg (controlado)", targetWeight)},
    }
}

func CheckGraduationCriterion(exercise string, weight, reps, targetWeight float64) bool {
    if weight < targetWeight {
        return false
    }
    switch exercise {
    case "squat":    return reps >= 3
    case "bench":    return reps >= 1
    case "deadlift": return reps >= 10
    }
    return false
}

func ComputeEpley1RM(weight, reps float64) float64 {
    if weight <= 0 || reps <= 0 {
        return 0
    }
    return weight * (1 + reps/30)
}

func SuggestNextWeight(previousWeight, secondPreviousWeight *float64, rounding float64) *float64 {
    if previousWeight == nil {
        return nil
    }
    if secondPreviousWeight == nil {
        v := RoundToNearest(*previousWeight+rounding, rounding)
        return &v
    }
    if *previousWeight > *secondPreviousWeight {
        v := *previousWeight
        return &v
    }
    v := RoundToNearest(*previousWeight+rounding, rounding)
    return &v
}
```

### `internal/engine/hydrate.go`

```go
func HydrateProgramDefinition(
    template TemplateRow,
    exerciseRows []ExerciseRow,
) (*ProgramDefinition, *HydrationError) {
    // 1. Unmarshal definition JSONB into a map to inspect exerciseIds
    var defMap map[string]any
    if err := json.Unmarshal(template.Definition, &defMap); err != nil {
        return nil, &HydrationError{Code: HydrationErrInvalidDefinition, Message: err.Error()}
    }

    // 2. Build exercise lookup
    lookup := make(map[string]string, len(exerciseRows))
    for _, er := range exerciseRows {
        lookup[er.ID] = er.Name
    }

    // 3. Collect referenced exercise IDs from slots + existing exercises map
    referenced := collectReferencedExerciseIDs(defMap)

    // 4. Check for missing exercises
    for id := range referenced {
        if _, ok := lookup[id]; !ok {
            return nil, &HydrationError{Code: HydrationErrMissingExercise, ExerciseID: id}
        }
    }

    // 5. Build exercises map with resolved names
    exercises := make(map[string]any, len(referenced))
    for id := range referenced {
        exercises[id] = map[string]any{"name": lookup[id]}
    }
    defMap["exercises"] = exercises

    // 6. Inject top-level template fields
    defMap["id"] = template.ID
    defMap["name"] = template.Name
    defMap["description"] = template.Description
    defMap["author"] = template.Author
    defMap["version"] = template.Version
    defMap["category"] = template.Category
    defMap["source"] = template.Source

    // 7. Re-marshal and unmarshal into ProgramDefinition
    b, err := json.Marshal(defMap)
    if err != nil {
        return nil, &HydrationError{Code: HydrationErrSchemaValidation, Message: err.Error()}
    }
    var def ProgramDefinition
    if err := json.Unmarshal(b, &def); err != nil {
        return nil, &HydrationError{Code: HydrationErrSchemaValidation, Message: err.Error()}
    }

    return &def, nil
}

func collectReferencedExerciseIDs(defMap map[string]any) map[string]struct{} {
    ids := make(map[string]struct{})
    // From slots
    days, _ := defMap["days"].([]any)
    for _, d := range days {
        day, _ := d.(map[string]any)
        slots, _ := day["slots"].([]any)
        for _, s := range slots {
            slot, _ := s.(map[string]any)
            if id, _ := slot["exerciseId"].(string); id != "" {
                ids[id] = struct{}{}
            }
        }
    }
    // From existing exercises map keys
    if ex, ok := defMap["exercises"].(map[string]any); ok {
        for id := range ex {
            ids[id] = struct{}{}
        }
    }
    return ids
}
```

---

## 5. Rate Limiter

In `internal/service/catalog.go`:

```go
type rateLimitEntry struct {
    mu          sync.Mutex
    count       int
    windowStart time.Time
}

var previewRateLimiter sync.Map // key: userID (string), value: *rateLimitEntry

const previewRateLimit = 30
const previewRateWindow = time.Hour

// checkPreviewRateLimit returns true if the request is allowed, false if rate limited.
func checkPreviewRateLimit(userID string) bool {
    val, _ := previewRateLimiter.LoadOrStore(userID, &rateLimitEntry{
        windowStart: time.Now(),
    })
    entry := val.(*rateLimitEntry)

    entry.mu.Lock()
    defer entry.mu.Unlock()

    now := time.Now()
    if now.Sub(entry.windowStart) >= previewRateWindow {
        entry.count = 0
        entry.windowStart = now
    }

    if entry.count >= previewRateLimit {
        return false
    }
    entry.count++
    return true
}
```

This is entirely in-process. No Redis. The `sync.Map` persists for the lifetime of the process; entries are never evicted, but since the window resets, this is acceptable (bounded memory: one entry per unique authenticated user who has called the endpoint).

---

## 6. API Handler Design

### Request body

```go
type previewRequest struct {
    Definition json.RawMessage `json:"definition"`
    Config     map[string]any  `json:"config"`
}
```

### HandlePreview (internal/handler/catalog.go)

```go
func (h *CatalogHandler) HandlePreview(w http.ResponseWriter, r *http.Request) {
    userID := mw.UserID(r.Context())

    var body previewRequest
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
        return
    }

    // 1. Parse definition
    var def engine.ProgramDefinition
    if err := json.Unmarshal(body.Definition, &def); err != nil {
        apierror.New(422, "Invalid program definition", apierror.CodeValidationError).Write(w)
        return
    }

    // 2. Validate definition
    if err := validateDefinition(def); err != nil {
        apierror.New(422, err.Error(), apierror.CodeValidationError).Write(w)
        return
    }

    // 3. Rate limit
    if !service.CheckPreviewRateLimit(userID) {
        apierror.New(429, "Rate limit exceeded", apierror.CodeRateLimited).
            WithHeaders(map[string]string{"Retry-After": "3600"}).
            Write(w)
        return
    }

    // 4. Compute
    rows, err := service.PreviewDefinition(def, body.Config)
    if err != nil {
        log := logging.FromContext(r.Context())
        log.Error("preview definition failed", "err", err)
        apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(rows)
}
```

### validateDefinition

```go
func validateDefinition(def engine.ProgramDefinition) error {
    if def.ID == "" {
        return fmt.Errorf("definition.id is required")
    }
    if len(def.Days) == 0 {
        return fmt.Errorf("definition.days must be non-empty")
    }
    if def.TotalWorkouts <= 0 {
        return fmt.Errorf("definition.totalWorkouts must be positive")
    }
    validRuleTypes := map[string]bool{
        "add_weight": true, "advance_stage": true, "advance_stage_add_weight": true,
        "deload_percent": true, "add_weight_reset_stage": true, "no_change": true,
        "update_tm": true, "double_progression": true,
    }
    for _, day := range def.Days {
        if len(day.Slots) == 0 {
            return fmt.Errorf("each day must have at least one slot")
        }
        for _, slot := range day.Slots {
            if len(slot.Stages) == 0 && len(slot.Prescriptions) == 0 {
                return fmt.Errorf("slot %q must have stages or prescriptions", slot.ID)
            }
            for _, rule := range []engine.ProgressionRule{slot.OnSuccess, slot.OnMidStageFail, slot.OnFinalStageFail} {
                if !validRuleTypes[rule.Type] {
                    return fmt.Errorf("unknown rule type %q in slot %q", rule.Type, slot.ID)
                }
                if err := validateRule(rule, slot); err != nil {
                    return err
                }
            }
            for _, optRule := range []*engine.ProgressionRule{slot.OnFinalStageSuccess, slot.OnUndefined} {
                if optRule != nil {
                    if !validRuleTypes[optRule.Type] {
                        return fmt.Errorf("unknown rule type %q in slot %q", optRule.Type, slot.ID)
                    }
                    if err := validateRule(*optRule, slot); err != nil {
                        return err
                    }
                }
            }
        }
    }
    return nil
}

func validateRule(rule engine.ProgressionRule, slot engine.ExerciseSlot) error {
    switch rule.Type {
    case "double_progression":
        if rule.RepRangeTop == nil || rule.RepRangeBottom == nil {
            return fmt.Errorf("double_progression rule in slot %q requires repRangeTop and repRangeBottom", slot.ID)
        }
    case "update_tm":
        if rule.Amount == nil || rule.MinAmrapReps == nil {
            return fmt.Errorf("update_tm rule in slot %q requires amount and minAmrapReps", slot.ID)
        }
        if slot.TrainingMaxKey == nil {
            return fmt.Errorf("update_tm rule in slot %q requires trainingMaxKey on slot", slot.ID)
        }
    case "deload_percent":
        if rule.Percent == nil {
            return fmt.Errorf("deload_percent rule in slot %q requires percent", slot.ID)
        }
    case "add_weight_reset_stage":
        if rule.Amount == nil {
            return fmt.Errorf("add_weight_reset_stage rule in slot %q requires amount", slot.ID)
        }
    }
    return nil
}
```

### PreviewDefinition (internal/service/catalog.go)

```go
func PreviewDefinition(def engine.ProgramDefinition, rawConfig map[string]any) ([]engine.GenericWorkoutRow, error) {
    config := resolveConfig(def, rawConfig)
    rows := engine.ComputeGenericProgram(def, config, engine.GenericResults{})
    return rows, nil
}
```

The service returns `error` for future-proofing (e.g., if definition size limits are added), but currently always returns nil.

---

## 7. Route Registration

In `internal/server/server.go`, insert before the existing public catalog GET routes:

```go
// Catalog routes.
api.With(mw.RequireAuth(cfg.JWTSecret)).Post("/catalog/preview", cat.HandlePreview)
api.Get("/catalog", cat.HandleList)
api.Get("/catalog/{programId}", cat.HandleGetDefinition)
```

The `POST /catalog/preview` route is authenticated (requires Bearer token). The existing GET routes remain public.

---

## 8. Test Strategy

### Unit tests: `internal/engine/engine_test.go`

Table-driven tests covering:

1. **RoundToNearest** — step=2.5: nominal, negative input (→0), NaN step (→half), zero step (→half), floating-point artifact case (e.g., 67.499... → 67.5)
2. **RoundToNearestHalf** — 0.3→0.5, 0.7→0.5, 1.0→1.0, negative→0
3. **configToNum** — string numeric, string non-numeric, float64, missing key, non-numeric type
4. **deriveResultFromSetLogs** — all-success, one-fail, in-between (nil), empty logs
5. **deriveResultFromSetLogsSimple** — all-pass, any-fail, empty logs
6. **add_weight rule** — 1 workout, success → weight increases by increment
7. **advance_stage rule** — fail at stage 0 → stage becomes 1; fail at final stage → stays at final
8. **advance_stage_add_weight** — success → stage+1 AND weight+increment
9. **deload_percent rule** — fail at final stage → weight\*0.9, stage reset to 0
10. **add_weight_reset_stage rule** — fail → weight += amount, stage reset to 0
11. **no_change rule** — result=fail → state unchanged
12. **double_progression** — setLogs all≥top → success; any<bottom → fail; between → nil (no change via onUndefined)
13. **update_tm rule** — amrapReps≥minAmrapReps → tm increases; below threshold → no change
14. **onFinalStageSuccess** — at final stage with success → uses onFinalStageSuccess rule instead of onSuccess
15. **onUndefined** — no result and no setLogs → applies onUndefined rule
16. **Prescription slot** — verifies weight = base1rm \* percent / 100 (rounded), last prescription is working set
17. **GPP slot** — weight=0, stage=0, stagesCount=1, isGpp=true
18. **isDeload** — weight decreases vs prev occurrence of same exerciseId → isDeload=true
19. **startWeightMultiplier** — initial weight = round(base \* multiplier, step)
20. **startWeightOffset** — initial weight = round(base - offset\*increment, step)
21. **progressionSetIndex** — only the indexed set determines progression
22. **GZCLP fixture** — load `testdata/gzclp.json`, run with default weights `{squat:60, bench:40, deadlift:60, ohp:30, latpulldown:30, dbrow:20}`, assert first 10 rows' exact weights/stages
23. **FormatDateLabel** — same year: "12 feb"; prior year: "12 feb 24"; invalid string: nil
24. **ExtractAllGenericStats** — empty rows → all empty slices; single success row → volumeData populated; RPE → rpeData; AMRAP → amrapData
25. **HydrateProgramDefinition** — success case, missing exercise → HydrationError, invalid JSONB → HydrationError
26. **ComputeGraduationTargets** — male multiplier=1.0, female multiplier=0.7
27. **SuggestNextWeight** — no previous→nil, one session, increased→maintain, maintained→increase

### Fixture: `internal/engine/testdata/gzclp.json`

Static JSON derived from `apps/api/src/db/seeds/programs/gzclp.ts`. The file contains the full GZCLP JSONB including `exercises` map with names (since in tests we don't run hydration — we embed the complete definition). Embed with `//go:embed testdata/gzclp.json` in `engine_test.go`.

The GZCLP definition needs `exercises` with names since `ComputeGenericProgram` reads `definition.exercises[slot.exerciseId].name`. Add exercise names to the fixture:

```json
{
  "id": "gzclp",
  "name": "GZCLP",
  "description": "",
  "author": "",
  "version": 1,
  "category": "strength",
  "source": "preset",
  "cycleLength": 4,
  "totalWorkouts": 90,
  "workoutsPerWeek": 3,
  "exercises": {
    "squat":      {"name": "Sentadilla"},
    "bench":      {"name": "Press Banca"},
    "deadlift":   {"name": "Peso Muerto"},
    "ohp":        {"name": "Press Militar"},
    "latpulldown":{"name": "Jalón al Pecho"},
    "dbrow":      {"name": "Remo con Mancuernas"}
  },
  "configFields": [...],
  "weightIncrements": {"squat": 5, "bench": 2.5, "deadlift": 5, "ohp": 2.5, "latpulldown": 2.5, "dbrow": 2.5},
  "days": [...]
}
```

The `days` array is copied verbatim from `gzclp.ts` GZCLP_DEFINITION_JSONB.

### Integration tests: harness

Add a new `describe('POST /api/catalog/preview', ...)` block to `apps/harness/src/tests/catalog.test.ts`. The harness already has auth helpers. Tests:

1. No auth → 401
2. Valid GZCLP definition + empty config → 200, array of `GenericWorkoutRow`
3. Invalid body → 422
4. Definition with unknown rule type → 422

---

## 9. Error Handling

| Condition                                 | HTTP Status | Code                                          |
| ----------------------------------------- | ----------- | --------------------------------------------- |
| No/invalid Bearer token                   | 401         | `UNAUTHORIZED`                                |
| Request body not valid JSON               | 422         | `VALIDATION_ERROR`                            |
| `definition` field fails `json.Unmarshal` | 422         | `VALIDATION_ERROR`                            |
| `validateDefinition` returns error        | 422         | `VALIDATION_ERROR`                            |
| Rate limit exceeded                       | 429         | `RATE_LIMITED` (+ `Retry-After: 3600` header) |
| Engine panic (recovered by `mw.Recovery`) | 500         | `INTERNAL_ERROR`                              |
| `service.PreviewDefinition` returns error | 500         | `INTERNAL_ERROR`                              |

Use `apierror.New(status, message, code).Write(w)` for all error paths. The existing `mw.Recovery` middleware handles panics — no explicit `recover()` needed in the handler.

---

## 10. Validation Logic

`validateDefinition` (called in handler before rate limit check — no point consuming quota for invalid input):

```
def.ID          must be non-empty string
def.Days        must be non-empty slice
def.TotalWorkouts must be > 0
for each day:
  day.Slots     must be non-empty slice
  for each slot:
    slot must have len(stages) > 0 OR len(prescriptions) > 0
    for each rule (onSuccess, onMidStageFail, onFinalStageFail,
                   onFinalStageSuccess?, onUndefined?):
      rule.Type must be one of the 8 known types
      "double_progression"    → repRangeTop != nil AND repRangeBottom != nil
      "update_tm"             → amount != nil AND minAmrapReps != nil
                                AND slot.trainingMaxKey != nil
      "deload_percent"        → percent != nil
      "add_weight_reset_stage"→ amount != nil
```

Note: we do NOT validate that `repRangeBottom <= repRangeTop` here (Zod does in TS, but the engine handles it gracefully either way). Keep the validator lean — reject structurally broken input, not semantically wrong but runnable input.

---

## 11. Dependencies

No new Go module dependencies. All engine code uses only:

- `math` — `math.Round`, `math.IsFinite`, `math.IsNaN`, `math.IsInf`
- `strconv` — `strconv.Itoa`, `strconv.ParseFloat`
- `sync` — `sync.Map`, `sync.Mutex`
- `time` — `time.Now`, `time.Hour`, `time.Parse`, `time.Since`
- `encoding/json` — `json.Unmarshal`, `json.Marshal`, `json.RawMessage`
- `fmt` — `fmt.Errorf`, `fmt.Sprintf`

Confirmed against `apps/go-api/go.mod`: no new `require` entries needed.

---

## 12. Completeness Checklist for Implementation Agent

- [ ] `internal/engine/types.go` — all structs with exact JSON tags (no omitempty on 8 required fields of GenericSlotRow/GenericWorkoutRow.IsChanged)
- [ ] `internal/engine/engine.go` — `ComputeGenericProgram`, all helpers, correct 3-branch slot rendering
- [ ] `internal/engine/stats.go` — `ExtractAllGenericStats`, Spanish month formatter, `computeSlotVolume`
- [ ] `internal/engine/graduation.go` — 4 functions matching TS signatures
- [ ] `internal/engine/hydrate.go` — round-trip via `map[string]any` (not direct struct unmarshal) to handle unknown JSONB fields gracefully
- [ ] `internal/engine/testdata/gzclp.json` — complete definition with exercise names
- [ ] `internal/engine/engine_test.go` — all 27 test cases, embed fixture
- [ ] `internal/handler/catalog.go` — `HandlePreview`, `validateDefinition`, `validateRule` (unexported helpers in same file)
- [ ] `internal/service/catalog.go` — `PreviewDefinition`, `resolveConfig`, `checkPreviewRateLimit`, `previewRateLimiter` sync.Map (exported `CheckPreviewRateLimit` wrapper for handler)
- [ ] `internal/server/server.go` — one line: `api.With(mw.RequireAuth(cfg.JWTSecret)).Post("/catalog/preview", cat.HandlePreview)` before the GET routes
- [ ] `apps/harness/src/tests/catalog.test.ts` — new describe block with 4 integration tests
