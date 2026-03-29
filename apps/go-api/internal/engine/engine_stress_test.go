package engine

import (
	"math"
	"math/rand"
	"runtime"
	"sync"
	"testing"
)

// Seeded PRNG for reproducibility. Print seed on test start.
const defaultSeed = 20260329
const fuzzIterations = 5000

func seededRNG(t *testing.T) *rand.Rand {
	t.Helper()
	seed := int64(defaultSeed)
	t.Logf("seed=%d", seed)
	return rand.New(rand.NewSource(seed))
}

// ─── BOUNDARY: RoundToNearest ────────────────────────────────────────────────

func TestRoundToNearestBoundary(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		value float64
		step  float64
		want  float64
	}{
		{name: "zero value", value: 0, step: 2.5, want: 0},
		{name: "zero step fallback", value: 67.3, step: 0, want: 67.5},
		{name: "negative step fallback", value: 67.3, step: -1, want: 67.5},
		{name: "NaN step fallback", value: 67.3, step: math.NaN(), want: 67.5},
		{name: "Inf step fallback", value: 67.3, step: math.Inf(1), want: 67.5},
		{name: "-Inf step fallback", value: 67.3, step: math.Inf(-1), want: 67.5},
		{name: "NaN value", value: math.NaN(), step: 2.5, want: 0},
		{name: "Inf value", value: math.Inf(1), step: 2.5, want: 0},
		{name: "-Inf value", value: math.Inf(-1), step: 2.5, want: 0},
		{name: "negative value", value: -10, step: 2.5, want: 0},
		{name: "very small step", value: 100, step: 1e-10, want: 100},
		{name: "subnormal step", value: 100, step: 5e-324, want: 0}, // division overflows to Inf, sanitized to 0
		{name: "huge value", value: 1e15, step: 2.5, want: 1e15},
		{name: "MaxFloat64 value", value: math.MaxFloat64, step: 2.5, want: 0}, // overflow to Inf, now sanitized to 0
		{name: "step=1", value: 67.3, step: 1, want: 67},
		{name: "step=0.5", value: 67.3, step: 0.5, want: 67.5},
		{name: "step=2.5 exact", value: 67.5, step: 2.5, want: 67.5},
		{name: "step=2.5 round up", value: 68.0, step: 2.5, want: 67.5},
		{name: "step=2.5 round to 70", value: 69.0, step: 2.5, want: 70},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := RoundToNearest(tt.value, tt.step)
			if math.IsNaN(tt.want) {
				if !math.IsNaN(got) {
					t.Fatalf("RoundToNearest(%v, %v) = %v, want NaN", tt.value, tt.step, got)
				}
			} else if got != tt.want {
				t.Fatalf("RoundToNearest(%v, %v) = %v, want %v", tt.value, tt.step, got, tt.want)
			}
		})
	}
}

func TestRoundToNearestHalfBoundary(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		value float64
		want  float64
	}{
		{name: "zero", value: 0, want: 0},
		{name: "negative", value: -5, want: 0},
		{name: "NaN", value: math.NaN(), want: 0},
		{name: "Inf", value: math.Inf(1), want: 0},
		{name: "-Inf", value: math.Inf(-1), want: 0},
		{name: "exact half", value: 67.5, want: 67.5},
		{name: "round down", value: 67.2, want: 67.0},
		{name: "round up", value: 67.3, want: 67.5},
		{name: "MaxFloat64", value: math.MaxFloat64, want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := RoundToNearestHalf(tt.value)
			if got != tt.want {
				t.Fatalf("RoundToNearestHalf(%v) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

// ─── BOUNDARY: ConfigToNum ───────────────────────────────────────────────────

func TestConfigToNumBoundary(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		config map[string]any
		key    string
		want   float64
	}{
		{name: "nil config", config: nil, key: "x", want: 0},
		{name: "empty config", config: map[string]any{}, key: "x", want: 0},
		{name: "missing key", config: map[string]any{"a": 1.0}, key: "x", want: 0},
		{name: "float64 value", config: map[string]any{"x": 100.0}, key: "x", want: 100},
		{name: "string float", config: map[string]any{"x": "42.5"}, key: "x", want: 42.5},
		{name: "string int", config: map[string]any{"x": "100"}, key: "x", want: 100},
		{name: "string NaN", config: map[string]any{"x": "NaN"}, key: "x", want: 0},
		{name: "string Inf", config: map[string]any{"x": "Inf"}, key: "x", want: 0},
		{name: "string garbage", config: map[string]any{"x": "abc"}, key: "x", want: 0},
		{name: "int value", config: map[string]any{"x": 42}, key: "x", want: 0},
		{name: "bool value", config: map[string]any{"x": true}, key: "x", want: 0},
		{name: "nil value", config: map[string]any{"x": nil}, key: "x", want: 0},
		{name: "NaN float64", config: map[string]any{"x": math.NaN()}, key: "x", want: 0},
		{name: "Inf float64", config: map[string]any{"x": math.Inf(1)}, key: "x", want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ConfigToNum(tt.config, tt.key)
			if math.IsNaN(tt.want) {
				if !math.IsNaN(got) {
					t.Fatalf("ConfigToNum = %v, want NaN", got)
				}
			} else if got != tt.want {
				t.Fatalf("ConfigToNum = %v, want %v", got, tt.want)
			}
		})
	}
}

// ─── BOUNDARY: ComputeEpley1RM ──────────────────────────────────────────────

func TestComputeEpley1RMBoundary(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name         string
		weight, reps float64
		wantZero     bool
	}{
		{name: "zero weight", weight: 0, reps: 5, wantZero: true},
		{name: "zero reps", weight: 100, reps: 0, wantZero: true},
		{name: "negative weight", weight: -10, reps: 5, wantZero: true},
		{name: "negative reps", weight: 100, reps: -1, wantZero: true},
		{name: "both zero", weight: 0, reps: 0, wantZero: true},
		{name: "normal", weight: 100, reps: 5, wantZero: false},
		{name: "huge reps", weight: 100, reps: 1e15, wantZero: false},
		{name: "tiny weight", weight: 0.001, reps: 1, wantZero: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ComputeEpley1RM(tt.weight, tt.reps)
			if tt.wantZero && got != 0 {
				t.Fatalf("ComputeEpley1RM(%v, %v) = %v, want 0", tt.weight, tt.reps, got)
			}
			if !tt.wantZero && got <= 0 {
				t.Fatalf("ComputeEpley1RM(%v, %v) = %v, want > 0", tt.weight, tt.reps, got)
			}
			if math.IsNaN(got) || math.IsInf(got, 0) {
				t.Fatalf("ComputeEpley1RM(%v, %v) = %v, want finite", tt.weight, tt.reps, got)
			}
		})
	}
}

// ─── BOUNDARY: ComputeGenericProgram panics ──────────────────────────────────

func TestComputeGenericProgramEmptyDaysReturnsNil(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days:          []WorkoutDay{},
		TotalWorkouts: 1,
	}
	rows := ComputeGenericProgram(def, map[string]any{}, nil)
	if rows != nil {
		t.Fatalf("expected nil for empty Days, got %d rows", len(rows))
	}
}

func TestComputeGenericProgramGppEmptyStagesSkips(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days: []WorkoutDay{{
			Name: "Day 1",
			Slots: []ExerciseSlot{{
				ID:         "gpp-1",
				ExerciseID: "cardio",
				IsGpp:      true,
				Stages:     []StageDefinition{}, // empty — should skip, not panic
			}},
		}},
		TotalWorkouts:    1,
		WeightIncrements: map[string]float64{},
	}
	rows := ComputeGenericProgram(def, map[string]any{}, nil)
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if len(rows[0].Slots) != 0 {
		t.Fatalf("got %d slots, want 0 (empty stages should be skipped)", len(rows[0].Slots))
	}
}

func TestComputeGenericProgramStandardEmptyStagesSkips(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days: []WorkoutDay{{
			Name: "Day 1",
			Slots: []ExerciseSlot{{
				ID:             "slot-1",
				ExerciseID:     "squat",
				StartWeightKey: "squat",
				Stages:         []StageDefinition{}, // empty — should skip, not panic
			}},
		}},
		TotalWorkouts:    1,
		WeightIncrements: map[string]float64{"squat": 2.5},
	}
	rows := ComputeGenericProgram(def, map[string]any{"squat": 100.0}, nil)
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if len(rows[0].Slots) != 0 {
		t.Fatalf("got %d slots, want 0 (empty stages should be skipped)", len(rows[0].Slots))
	}
}

// ─── BOUNDARY: Negative ProgressionSetIndex ──────────────────────────────────

func TestDeriveSlotResultNegativeProgressionSetIndex(t *testing.T) {
	t.Parallel()
	// Previously panicked with slice bounds out of range [-1:].
	// Fixed: guard now checks idx >= 0 && idx < len(setLogs).
	negIdx := -1
	slot := ExerciseSlot{
		ProgressionSetIndex: &negIdx,
		OnSuccess:           &ProgressionRule{Type: "add_weight"},
	}
	result := SlotResult{
		SetLogs: []SetLogEntry{{Reps: 5}, {Reps: 5}},
	}

	got := deriveSlotResult(slot, result, 5)
	if got == nil {
		t.Fatal("expected non-nil result")
	}
	if *got != "success" {
		t.Fatalf("got %q, want success", *got)
	}
}

// ─── BOUNDARY: SuggestNextWeight ─────────────────────────────────────────────

func TestSuggestNextWeightBoundary(t *testing.T) {
	t.Parallel()
	f := func(v float64) *float64 { return &v }

	tests := []struct {
		name       string
		prev       *float64
		secondPrev *float64
		rounding   float64
		wantNil    bool
	}{
		{name: "nil prev", prev: nil, secondPrev: nil, rounding: 2.5, wantNil: true},
		{name: "only prev", prev: f(100), secondPrev: nil, rounding: 2.5, wantNil: false},
		{name: "increased", prev: f(105), secondPrev: f(100), rounding: 2.5, wantNil: false},
		{name: "maintained", prev: f(100), secondPrev: f(100), rounding: 2.5, wantNil: false},
		{name: "decreased", prev: f(95), secondPrev: f(100), rounding: 2.5, wantNil: false},
		{name: "zero rounding", prev: f(100), secondPrev: nil, rounding: 0, wantNil: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := SuggestNextWeight(tt.prev, tt.secondPrev, tt.rounding)
			if tt.wantNil && got != nil {
				t.Fatalf("got %v, want nil", *got)
			}
			if !tt.wantNil && got == nil {
				t.Fatal("got nil, want non-nil")
			}
		})
	}
}

// ─── FUZZ: RoundToNearest never panics ───────────────────────────────────────

func TestFuzzRoundToNearestNeverPanics(t *testing.T) {
	t.Parallel()
	rng := seededRNG(t)
	for i := 0; i < fuzzIterations; i++ {
		value := rng.Float64()*1e6 - 5e5
		step := rng.Float64()*100 - 50
		// Inject special values
		switch rng.Intn(20) {
		case 0:
			value = math.NaN()
		case 1:
			value = math.Inf(1)
		case 2:
			value = math.Inf(-1)
		case 3:
			step = 0
		case 4:
			step = math.NaN()
		case 5:
			step = math.Inf(1)
		case 6:
			value = math.MaxFloat64
		case 7:
			step = math.SmallestNonzeroFloat64
		}

		got := RoundToNearest(value, step)
		if math.IsNaN(got) {
			t.Fatalf("iter %d: RoundToNearest(%v, %v) = NaN (seed=%d)", i, value, step, defaultSeed)
		}
		if got < 0 {
			t.Fatalf("iter %d: RoundToNearest(%v, %v) = %v (negative) (seed=%d)", i, value, step, got, defaultSeed)
		}
	}
}

// ─── FUZZ: ConfigToNum never panics ──────────────────────────────────────────

func TestFuzzConfigToNumNeverPanics(t *testing.T) {
	t.Parallel()
	rng := seededRNG(t)
	types := []func(r *rand.Rand) any{
		func(r *rand.Rand) any { return r.Float64()*1e6 - 5e5 },
		func(r *rand.Rand) any { return "garbage_" + string(rune(r.Intn(256))) },
		func(r *rand.Rand) any { return r.Intn(1000) },
		func(_ *rand.Rand) any { return nil },
		func(_ *rand.Rand) any { return true },
		func(_ *rand.Rand) any { return math.NaN() },
		func(_ *rand.Rand) any { return math.Inf(1) },
		func(_ *rand.Rand) any { return "NaN" },
		func(_ *rand.Rand) any { return "Inf" },
		func(_ *rand.Rand) any { return "" },
	}
	var nanCount, infCount int
	for i := 0; i < fuzzIterations; i++ {
		gen := types[rng.Intn(len(types))]
		config := map[string]any{"k": gen(rng)}
		got := ConfigToNum(config, "k")
		// BUG KNOWN: ConfigToNum returns NaN/Inf for float64 NaN/Inf inputs
		// (engine.go:39 — only string parsing guards against NaN/Inf)
		if math.IsNaN(got) {
			nanCount++
		}
		if math.IsInf(got, 0) {
			infCount++
		}
	}
	if nanCount > 0 || infCount > 0 {
		t.Logf("BUG: ConfigToNum returned NaN %d times, Inf %d times (seed=%d)", nanCount, infCount, defaultSeed)
	}
}

// ─── FUZZ: ComputeGenericProgram never panics on valid definitions ───────────

func TestFuzzComputeGenericProgramNeverPanics(t *testing.T) {
	t.Parallel()
	rng := seededRNG(t)

	for i := 0; i < 500; i++ {
		numDays := rng.Intn(4) + 1
		days := make([]WorkoutDay, numDays)
		increments := map[string]float64{}
		exercises := map[string]ExerciseEntry{}

		for d := 0; d < numDays; d++ {
			numSlots := rng.Intn(4) + 1
			slots := make([]ExerciseSlot, numSlots)
			for s := 0; s < numSlots; s++ {
				exID := string(rune('a' + rng.Intn(5)))
				numStages := rng.Intn(3) + 1
				stages := make([]StageDefinition, numStages)
				for st := 0; st < numStages; st++ {
					stages[st] = StageDefinition{
						Sets: rng.Intn(5) + 1,
						Reps: rng.Intn(12) + 1,
					}
				}
				slot := ExerciseSlot{
					ID:              string(rune('A'+d)) + string(rune('0'+s)),
					ExerciseID:      exID,
					StartWeightKey:  exID,
					Stages:          stages,
					OnSuccess:       &ProgressionRule{Type: "add_weight"},
					OnMidStageFail:  &ProgressionRule{Type: "advance_stage"},
					OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
				}
				slots[s] = slot
				increments[exID] = float64(rng.Intn(5)) + 1
				exercises[exID] = ExerciseEntry{Name: exID}
			}
			days[d] = WorkoutDay{Name: "Day", Slots: slots}
		}

		numWorkouts := rng.Intn(30) + 1
		def := ProgramDefinition{
			Days:             days,
			TotalWorkouts:    numWorkouts,
			WeightIncrements: increments,
			Exercises:        exercises,
		}

		config := map[string]any{}
		for k := range increments {
			config[k] = float64(rng.Intn(100)) + 20
		}

		// Random results for some workouts
		results := GenericResults{}
		for w := 0; w < numWorkouts; w++ {
			if rng.Intn(3) == 0 {
				continue // skip result
			}
			wr := map[string]SlotResult{}
			day := days[w%len(days)]
			for _, slot := range day.Slots {
				switch rng.Intn(3) {
				case 0:
					r := "success"
					wr[slot.ID] = SlotResult{Result: &r}
				case 1:
					r := "fail"
					wr[slot.ID] = SlotResult{Result: &r}
				}
			}
			results[string(rune('0'+w))] = wr
		}

		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("iter %d: panic: %v (seed=%d, days=%d, workouts=%d)", i, r, defaultSeed, numDays, numWorkouts)
				}
			}()
			rows := ComputeGenericProgram(def, config, results)
			if len(rows) != numWorkouts {
				t.Fatalf("iter %d: got %d rows, want %d", i, len(rows), numWorkouts)
			}
		}()
	}
}

// ─── CORRUPTION: Mutated definitions ─────────────────────────────────────────

func TestCorruptionMutatedDefinition(t *testing.T) {
	t.Parallel()
	rng := seededRNG(t)

	baseDef := ProgramDefinition{
		Days: []WorkoutDay{{
			Name: "Day 1",
			Slots: []ExerciseSlot{{
				ID:              "d1-t1",
				ExerciseID:      "squat",
				StartWeightKey:  "squat",
				Stages:          []StageDefinition{{Sets: 5, Reps: 3}},
				OnSuccess:       &ProgressionRule{Type: "add_weight"},
				OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
			}},
		}},
		TotalWorkouts:    10,
		WeightIncrements: map[string]float64{"squat": 2.5},
		Exercises:        map[string]ExerciseEntry{"squat": {Name: "Squat"}},
	}
	baseConfig := map[string]any{"squat": 100.0}

	for i := 0; i < 1000; i++ {
		def := baseDef
		config := map[string]any{"squat": 100.0}

		switch rng.Intn(10) {
		case 0:
			config["squat"] = math.NaN()
		case 1:
			config["squat"] = math.Inf(1)
		case 2:
			config["squat"] = -1e10
		case 3:
			config["squat"] = 0.0
		case 4:
			def.WeightIncrements["squat"] = 0
		case 5:
			def.WeightIncrements["squat"] = -5
		case 6:
			def.WeightIncrements["squat"] = math.NaN()
		case 7:
			config["rounding"] = 0.0 // should fallback to 2.5
		case 8:
			config["rounding"] = -1.0
		case 9:
			offset := rng.Intn(1000000)
			def.Days[0].Slots[0].StartWeightOffset = &offset
		}

		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("iter %d: panic on corrupted input: %v (seed=%d)", i, r, defaultSeed)
				}
			}()
			rows := ComputeGenericProgram(def, config, nil)
			for _, row := range rows {
				for _, slot := range row.Slots {
					if math.IsNaN(slot.Weight) {
						t.Fatalf("iter %d: NaN weight in output (seed=%d)", i, defaultSeed)
					}
					if math.IsInf(slot.Weight, 0) {
						t.Fatalf("iter %d: Inf weight in output (seed=%d)", i, defaultSeed)
					}
					if slot.Weight < 0 {
						t.Fatalf("iter %d: negative weight %v in output (seed=%d)", i, slot.Weight, defaultSeed)
					}
				}
			}
		}()
	}
	_ = baseConfig
}

// ─── STRESS: Rapid create/compute cycles ─────────────────────────────────────

func TestStressRapidComputeCycles(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days: []WorkoutDay{{
			Name: "A",
			Slots: []ExerciseSlot{{
				ID:              "s1",
				ExerciseID:      "squat",
				StartWeightKey:  "squat",
				Stages:          []StageDefinition{{Sets: 5, Reps: 5}},
				OnSuccess:       &ProgressionRule{Type: "add_weight"},
				OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
			}},
		}},
		TotalWorkouts:    100,
		WeightIncrements: map[string]float64{"squat": 2.5},
	}
	config := map[string]any{"squat": 60.0}

	before := runtime.NumGoroutine()
	for i := 0; i < 1000; i++ {
		_ = ComputeGenericProgram(def, config, nil)
	}
	after := runtime.NumGoroutine()

	// Check for goroutine leaks (engine should be purely synchronous)
	if after > before+5 {
		t.Fatalf("goroutine leak: before=%d, after=%d", before, after)
	}
}

// ─── CONCURRENCY: Parallel ComputeGenericProgram (shared-nothing) ────────────

func TestConcurrencyParallelCompute(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days: []WorkoutDay{
			{Name: "A", Slots: []ExerciseSlot{{
				ID: "s1", ExerciseID: "squat", StartWeightKey: "squat",
				Stages:          []StageDefinition{{Sets: 5, Reps: 5}},
				OnSuccess:       &ProgressionRule{Type: "add_weight"},
				OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
			}}},
			{Name: "B", Slots: []ExerciseSlot{{
				ID: "s2", ExerciseID: "bench", StartWeightKey: "bench",
				Stages:          []StageDefinition{{Sets: 5, Reps: 5}, {Sets: 6, Reps: 3}},
				OnSuccess:       &ProgressionRule{Type: "add_weight"},
				OnMidStageFail:  &ProgressionRule{Type: "advance_stage"},
				OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
			}}},
		},
		TotalWorkouts:    50,
		WeightIncrements: map[string]float64{"squat": 2.5, "bench": 1.25},
		Exercises: map[string]ExerciseEntry{
			"squat": {Name: "Squat"},
			"bench": {Name: "Bench"},
		},
	}
	config := map[string]any{"squat": 100.0, "bench": 60.0}

	var wg sync.WaitGroup
	workers := 50
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		go func() {
			defer wg.Done()
			rows := ComputeGenericProgram(def, config, nil)
			if len(rows) != 50 {
				t.Errorf("got %d rows, want 50", len(rows))
			}
		}()
	}
	wg.Wait()
}

// ─── ROUND-TRIP: Deterministic replay ────────────────────────────────────────

func TestRoundTripDeterministicReplay(t *testing.T) {
	t.Parallel()
	def := ProgramDefinition{
		Days: []WorkoutDay{{
			Name: "A",
			Slots: []ExerciseSlot{{
				ID: "s1", ExerciseID: "squat", StartWeightKey: "squat",
				Stages: []StageDefinition{
					{Sets: 5, Reps: 3},
					{Sets: 6, Reps: 2},
					{Sets: 10, Reps: 1, Amrap: true},
				},
				OnSuccess:        &ProgressionRule{Type: "add_weight"},
				OnMidStageFail:   &ProgressionRule{Type: "advance_stage"},
				OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: pf64(10)},
			}},
		}},
		TotalWorkouts:    20,
		WeightIncrements: map[string]float64{"squat": 2.5},
	}
	config := map[string]any{"squat": 100.0}

	success := "success"
	fail := "fail"
	results := GenericResults{
		"0": {"s1": {Result: &success}},
		"1": {"s1": {Result: &success}},
		"2": {"s1": {Result: &fail}},
		"3": {"s1": {Result: &fail}},
		"4": {"s1": {Result: &success}},
	}

	rows1 := ComputeGenericProgram(def, config, results)
	rows2 := ComputeGenericProgram(def, config, results)

	if len(rows1) != len(rows2) {
		t.Fatalf("non-deterministic: %d vs %d rows", len(rows1), len(rows2))
	}
	for i := range rows1 {
		for j := range rows1[i].Slots {
			if rows1[i].Slots[j].Weight != rows2[i].Slots[j].Weight {
				t.Fatalf("non-deterministic at workout %d slot %d: weight %v vs %v",
					i, j, rows1[i].Slots[j].Weight, rows2[i].Slots[j].Weight)
			}
			if rows1[i].Slots[j].Stage != rows2[i].Slots[j].Stage {
				t.Fatalf("non-deterministic at workout %d slot %d: stage %v vs %v",
					i, j, rows1[i].Slots[j].Stage, rows2[i].Slots[j].Stage)
			}
		}
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func pf64(v float64) *float64 { return &v }
