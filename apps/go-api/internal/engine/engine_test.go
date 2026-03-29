package engine

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

// ---------------------------------------------------------------------------
// RoundToNearestHalf
// ---------------------------------------------------------------------------

func TestRoundToNearestHalf(t *testing.T) {
	cases := []struct {
		in   float64
		want float64
	}{
		{0.7, 0.5},
		{0.8, 1.0},
		{0.0, 0.0},
		{-5, 0},
		{1.25, 1.5},
		{2.74, 2.5},
		{2.75, 3.0},
	}
	for _, tc := range cases {
		got := RoundToNearestHalf(tc.in)
		if got != tc.want {
			t.Errorf("RoundToNearestHalf(%v) = %v, want %v", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// RoundToNearest
// ---------------------------------------------------------------------------

func TestRoundToNearest(t *testing.T) {
	cases := []struct {
		value float64
		step  float64
		want  float64
	}{
		{67.4999999, 2.5, 67.5},
		{26, 2.5, 25},
		{52, 2.5, 52.5},
		{5.7, 0, 5.5},     // step=0 → falls back to RoundToNearestHalf
		{-10, 2.5, 0},     // negative → 0
		{math.NaN(), 2.5, 0}, // NaN input
		{0, 2.5, 0},
		{2.5, 2.5, 2.5},
		{100, 5, 100},
		{97.5, 5, 100},  // math.Round(97.5/5)=20 → 100 (matches TS oracle)
	}
	for _, tc := range cases {
		got := RoundToNearest(tc.value, tc.step)
		if math.IsNaN(tc.want) {
			if !math.IsNaN(got) {
				t.Errorf("RoundToNearest(%v,%v) = %v, want NaN", tc.value, tc.step, got)
			}
		} else if got != tc.want {
			t.Errorf("RoundToNearest(%v,%v) = %v, want %v", tc.value, tc.step, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// ConfigToNum
// ---------------------------------------------------------------------------

func TestConfigToNum(t *testing.T) {
	config := map[string]any{
		"float":   float64(42.5),
		"str":     "75.0",
		"nonNum":  "abc",
		"boolVal": true,
		"zero":    float64(0),
	}

	cases := []struct {
		key  string
		want float64
	}{
		{"float", 42.5},
		{"str", 75.0},
		{"nonNum", 0},
		{"boolVal", 0},
		{"missing", 0},
		{"zero", 0},
	}
	for _, tc := range cases {
		got := ConfigToNum(config, tc.key)
		if got != tc.want {
			t.Errorf("ConfigToNum(%q) = %v, want %v", tc.key, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers — single-slot program builder
// ---------------------------------------------------------------------------

func ptr[T any](v T) *T { return &v }

// makeSingleSlotDef builds a minimal ProgramDefinition with one day, one slot.
func makeSingleSlotDef(slot ExerciseSlot) ProgramDefinition {
	return ProgramDefinition{
		ID:          "test",
		TotalWorkouts: 4,
		Days: []WorkoutDay{
			{Name: "Day 1", Slots: []ExerciseSlot{slot}},
		},
		Exercises:        map[string]ExerciseEntry{"ex1": {Name: "Exercise 1"}},
		WeightIncrements: map[string]float64{"ex1": 5},
	}
}

// ---------------------------------------------------------------------------
// AddWeight rule
// ---------------------------------------------------------------------------

func TestAddWeightRule(t *testing.T) {
	slot := ExerciseSlot{
		ID:             "s1",
		ExerciseID:     "ex1",
		Tier:           "t1",
		Stages:         []StageDefinition{{Sets: 5, Reps: 3}},
		OnSuccess:      &ProgressionRule{Type: "add_weight"},
		OnMidStageFail: &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey: "ex1",
	}
	def := makeSingleSlotDef(slot)
	config := map[string]any{"ex1": float64(60)}

	// Workout 0: no result → progression applies onUndefined (nil) → onSuccess (add_weight)
	// Workout 1: should see weight 65
	results := GenericResults{
		"0": {"s1": SlotResult{Result: ptr("success")}},
	}
	rows := ComputeGenericProgram(def, config, results)
	if rows[0].Slots[0].Weight != 60 {
		t.Errorf("workout 0 weight = %v, want 60", rows[0].Slots[0].Weight)
	}
	if rows[1].Slots[0].Weight != 65 {
		t.Errorf("workout 1 weight = %v, want 65 (add_weight after success)", rows[1].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// AdvanceStage rule
// ---------------------------------------------------------------------------

func TestAdvanceStage(t *testing.T) {
	slot := ExerciseSlot{
		ID:         "s1",
		ExerciseID: "ex1",
		Tier:       "t1",
		Stages: []StageDefinition{
			{Sets: 5, Reps: 3},
			{Sets: 6, Reps: 2},
		},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnMidStageFail:   &ProgressionRule{Type: "advance_stage"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}
	def := makeSingleSlotDef(slot)
	config := map[string]any{"ex1": float64(100)}

	results := GenericResults{
		"0": {"s1": SlotResult{Result: ptr("fail")}},
	}
	rows := ComputeGenericProgram(def, config, results)
	if rows[0].Slots[0].Stage != 0 {
		t.Errorf("workout 0 stage = %v, want 0", rows[0].Slots[0].Stage)
	}
	if rows[1].Slots[0].Stage != 1 {
		t.Errorf("workout 1 stage = %v, want 1 (advanced after fail)", rows[1].Slots[0].Stage)
	}
}

// ---------------------------------------------------------------------------
// DeloadPercent rule
// ---------------------------------------------------------------------------

func TestDeloadPercent(t *testing.T) {
	slot := ExerciseSlot{
		ID:         "s1",
		ExerciseID: "ex1",
		Tier:       "t1",
		Stages: []StageDefinition{
			{Sets: 5, Reps: 3},
		},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnMidStageFail:   &ProgressionRule{Type: "deload_percent", Percent: ptr(10.0)},
		OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: ptr(10.0)},
		StartWeightKey:   "ex1",
	}
	def := makeSingleSlotDef(slot)
	config := map[string]any{"ex1": float64(100)}

	results := GenericResults{
		"0": {"s1": SlotResult{Result: ptr("fail")}},
	}
	rows := ComputeGenericProgram(def, config, results)
	if rows[0].Slots[0].Weight != 100 {
		t.Errorf("workout 0 weight = %v, want 100", rows[0].Slots[0].Weight)
	}
	// 100 * (1 - 10/100) = 90, rounded to nearest 2.5 = 90
	if rows[1].Slots[0].Weight != 90 {
		t.Errorf("workout 1 weight = %v, want 90 (deload 10%%)", rows[1].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// NoChange rule
// ---------------------------------------------------------------------------

func TestNoChange(t *testing.T) {
	slot := ExerciseSlot{
		ID:               "s1",
		ExerciseID:       "ex1",
		Tier:             "t1",
		Stages:           []StageDefinition{{Sets: 3, Reps: 10}},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnUndefined:      &ProgressionRule{Type: "no_change"},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}
	def := makeSingleSlotDef(slot)
	config := map[string]any{"ex1": float64(50)}

	// No results at all — no_change keeps weight
	rows := ComputeGenericProgram(def, config, nil)
	for i, row := range rows {
		if row.Slots[0].Weight != 50 {
			t.Errorf("workout %d weight = %v, want 50 (no_change)", i, row.Slots[0].Weight)
		}
	}
}

// ---------------------------------------------------------------------------
// Double progression
// ---------------------------------------------------------------------------

func TestDoubleProg(t *testing.T) {
	slot := ExerciseSlot{
		ID:         "s1",
		ExerciseID: "ex1",
		Tier:       "t1",
		Stages: []StageDefinition{
			{Sets: 3, Reps: 8},
		},
		OnSuccess:        &ProgressionRule{Type: "double_progression", RepRangeTop: ptr(12), RepRangeBottom: ptr(8)},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}
	def := makeSingleSlotDef(slot)
	config := map[string]any{"ex1": float64(60)}

	// All logs >= repRangeTop (12) → derived success → weight increases
	results := GenericResults{
		"0": {"s1": SlotResult{SetLogs: []SetLogEntry{{Reps: 12}, {Reps: 12}, {Reps: 12}}}},
	}
	rows := ComputeGenericProgram(def, config, results)
	if rows[0].Slots[0].Weight != 60 {
		t.Errorf("workout 0 weight = %v, want 60", rows[0].Slots[0].Weight)
	}
	if rows[1].Slots[0].Weight != 65 {
		t.Errorf("workout 1 weight = %v, want 65 (double prog success)", rows[1].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// DeriveSlotResult
// ---------------------------------------------------------------------------

func TestDeriveSlotResult(t *testing.T) {
	dpSlot := ExerciseSlot{
		ID:               "s1",
		ExerciseID:       "ex1",
		Tier:             "t1",
		Stages:           []StageDefinition{{Sets: 3, Reps: 8}},
		OnSuccess:        &ProgressionRule{Type: "double_progression", RepRangeTop: ptr(12), RepRangeBottom: ptr(8)},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}

	simpleSlot := ExerciseSlot{
		ID:               "s1",
		ExerciseID:       "ex1",
		Tier:             "t1",
		Stages:           []StageDefinition{{Sets: 5, Reps: 3}},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}

	t.Run("double_prog_success", func(t *testing.T) {
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 12}, {Reps: 12}, {Reps: 12}}}
		got := deriveSlotResult(dpSlot, res, 8)
		if got == nil || *got != "success" {
			t.Errorf("expected success, got %v", got)
		}
	})

	t.Run("double_prog_fail", func(t *testing.T) {
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 12}, {Reps: 7}, {Reps: 12}}}
		got := deriveSlotResult(dpSlot, res, 8)
		if got == nil || *got != "fail" {
			t.Errorf("expected fail, got %v", got)
		}
	})

	t.Run("double_prog_in_range", func(t *testing.T) {
		// 8-11 reps — in range, should fall back to explicit result
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 10}, {Reps: 9}, {Reps: 8}}, Result: ptr("success")}
		got := deriveSlotResult(dpSlot, res, 8)
		if got == nil || *got != "success" {
			t.Errorf("expected success (fallback), got %v", got)
		}
	})

	t.Run("simple_threshold_success", func(t *testing.T) {
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 5}, {Reps: 5}, {Reps: 5}}}
		got := deriveSlotResult(simpleSlot, res, 3)
		if got == nil || *got != "success" {
			t.Errorf("expected success, got %v", got)
		}
	})

	t.Run("simple_threshold_fail", func(t *testing.T) {
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 5}, {Reps: 2}, {Reps: 5}}}
		got := deriveSlotResult(simpleSlot, res, 3)
		if got == nil || *got != "fail" {
			t.Errorf("expected fail, got %v", got)
		}
	})

	t.Run("empty_logs", func(t *testing.T) {
		res := SlotResult{Result: ptr("success")}
		got := deriveSlotResult(simpleSlot, res, 3)
		if got == nil || *got != "success" {
			t.Errorf("expected success (from explicit result), got %v", got)
		}
	})

	t.Run("progressionSetIndex", func(t *testing.T) {
		slot := simpleSlot
		slot.ProgressionSetIndex = ptr(2)
		// Set at index 2 has reps=2 < 3 → fail
		res := SlotResult{SetLogs: []SetLogEntry{{Reps: 5}, {Reps: 5}, {Reps: 2}}}
		got := deriveSlotResult(slot, res, 3)
		if got == nil || *got != "fail" {
			t.Errorf("expected fail (progressionSetIndex), got %v", got)
		}
	})
}

// ---------------------------------------------------------------------------
// Prescription slot
// ---------------------------------------------------------------------------

func TestPrescriptionSlot(t *testing.T) {
	slot := ExerciseSlot{
		ID:         "ps1",
		ExerciseID: "ex1",
		Tier:       "t1",
		Stages:     []StageDefinition{{Sets: 3, Reps: 5}},
		Prescriptions: []PrescriptionEntry{
			{Percent: 70, Sets: 3, Reps: 5},
			{Percent: 80, Sets: 3, Reps: 5},
		},
		PercentOf:        "oneRM",
		OnSuccess:        &ProgressionRule{Type: "no_change"},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}
	def := ProgramDefinition{
		ID:              "test",
		TotalWorkouts:   2,
		Days:            []WorkoutDay{{Name: "Day 1", Slots: []ExerciseSlot{slot}}},
		Exercises:       map[string]ExerciseEntry{"ex1": {Name: "Exercise 1"}},
		WeightIncrements: map[string]float64{"ex1": 5},
	}
	// 80% of 200 = 160, rounded to 2.5 = 160
	config := map[string]any{"ex1": float64(0), "oneRM": float64(200)}
	rows := ComputeGenericProgram(def, config, nil)
	if rows[0].Slots[0].Weight != 160 {
		t.Errorf("prescription weight = %v, want 160", rows[0].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// GPP slot
// ---------------------------------------------------------------------------

func TestGPPSlot(t *testing.T) {
	isGppSlot := ExerciseSlot{
		ID:               "gpp1",
		ExerciseID:       "ex1",
		Tier:             "t3",
		IsGpp:            true,
		Stages:           []StageDefinition{{Sets: 3, Reps: 15}},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnMidStageFail:   &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:   "ex1",
	}
	def := ProgramDefinition{
		ID:              "test",
		TotalWorkouts:   4,
		Days:            []WorkoutDay{{Name: "Day 1", Slots: []ExerciseSlot{isGppSlot}}},
		Exercises:       map[string]ExerciseEntry{"ex1": {Name: "Exercise 1"}},
		WeightIncrements: map[string]float64{"ex1": 5},
	}
	config := map[string]any{"ex1": float64(100)}
	// Even with results marked success, GPP slots have weight=0 always
	results := GenericResults{
		"0": {"gpp1": SlotResult{Result: ptr("success")}},
		"1": {"gpp1": SlotResult{Result: ptr("success")}},
		"2": {"gpp1": SlotResult{Result: ptr("success")}},
	}
	rows := ComputeGenericProgram(def, config, results)
	for i, row := range rows {
		if row.Slots[0].Weight != 0 {
			t.Errorf("GPP workout %d weight = %v, want 0", i, row.Slots[0].Weight)
		}
	}
}

// ---------------------------------------------------------------------------
// TM Update
// ---------------------------------------------------------------------------

func TestTMUpdate(t *testing.T) {
	slot := ExerciseSlot{
		ID:             "s1",
		ExerciseID:     "ex1",
		Tier:           "t1",
		Stages:         []StageDefinition{{Sets: 1, Reps: 1, Amrap: true}},
		OnSuccess:      &ProgressionRule{Type: "update_tm", Amount: ptr(5.0), MinAmrapReps: ptr(1)},
		OnMidStageFail: &ProgressionRule{Type: "no_change"},
		OnFinalStageFail: &ProgressionRule{Type: "no_change"},
		StartWeightKey:  "ex1",
		TrainingMaxKey:  "tmEx1",
		TmPercent:       ptr(0.85),
	}
	def := ProgramDefinition{
		ID:              "test",
		TotalWorkouts:   3,
		Days:            []WorkoutDay{{Name: "Day 1", Slots: []ExerciseSlot{slot}}},
		Exercises:       map[string]ExerciseEntry{"ex1": {Name: "Exercise 1"}},
		WeightIncrements: map[string]float64{"ex1": 2.5},
	}
	config := map[string]any{"ex1": float64(0), "tmEx1": float64(100)}

	// Workout 0: amrapReps=3 >= minAmrapReps=1 → TM increases by 5
	// Workout 1: weight = 85% of 105 = 89.25 → rounded to 2.5 = 90
	results := GenericResults{
		"0": {"s1": SlotResult{AmrapReps: ptr(3)}},
	}
	rows := ComputeGenericProgram(def, config, results)
	// Workout 0: TM=100, weight = 100*0.85=85
	if rows[0].Slots[0].Weight != 85 {
		t.Errorf("workout 0 weight = %v, want 85", rows[0].Slots[0].Weight)
	}
	// After workout 0 success: TM = 100+5=105, weight = 105*0.85=89.25 → 90
	if rows[1].Slots[0].Weight != 90 {
		t.Errorf("workout 1 weight = %v, want 90 (after TM update)", rows[1].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// Deload detection
// ---------------------------------------------------------------------------

func TestDeloadDetection(t *testing.T) {
	// Two slots same exercise: first workout has high weight, second has lower → isDeload
	slot := ExerciseSlot{
		ID:               "s1",
		ExerciseID:       "ex1",
		Tier:             "t1",
		Stages:           []StageDefinition{{Sets: 5, Reps: 3}, {Sets: 6, Reps: 2}},
		OnSuccess:        &ProgressionRule{Type: "add_weight"},
		OnMidStageFail:   &ProgressionRule{Type: "advance_stage"},
		OnFinalStageFail: &ProgressionRule{Type: "deload_percent", Percent: ptr(10.0)},
		StartWeightKey:   "ex1",
	}
	def := ProgramDefinition{
		ID:            "test",
		TotalWorkouts: 5,
		Days: []WorkoutDay{
			{Name: "Day A", Slots: []ExerciseSlot{slot}},
		},
		Exercises:        map[string]ExerciseEntry{"ex1": {Name: "Exercise 1"}},
		WeightIncrements: map[string]float64{"ex1": 5},
	}
	config := map[string]any{"ex1": float64(100)}

	// 0: success (100→snapshot) → weight becomes 105
	// 1: success (105→snapshot) → weight becomes 110
	// 2: fail (mid-stage, stage=0) → advance_stage, weight stays 110
	// 3: fail (final stage=1) → deload_percent → weight = 110*0.9=99 → rounded 2.5 = 100
	// 4: snapshot shows weight=100 < prev 110 → isDeload=true
	results := GenericResults{
		"0": {"s1": SlotResult{Result: ptr("success")}},
		"1": {"s1": SlotResult{Result: ptr("success")}},
		"2": {"s1": SlotResult{Result: ptr("fail")}},
		"3": {"s1": SlotResult{Result: ptr("fail")}},
	}
	rows := ComputeGenericProgram(def, config, results)

	// Workout 4 shows the deload (weight 100 < previous 110)
	if !rows[4].Slots[0].IsDeload {
		t.Errorf("workout 4 should be flagged as deload (weight %v)", rows[4].Slots[0].Weight)
	}
}

// ---------------------------------------------------------------------------
// GZCLP fixture
// ---------------------------------------------------------------------------

type gzclpSlotExpected struct {
	SlotID     string  `json:"slotId"`
	ExerciseID string  `json:"exerciseId"`
	Weight     float64 `json:"weight"`
	Stage      int     `json:"stage"`
	Sets       int     `json:"sets"`
	Reps       int     `json:"reps"`
}

type gzclpRowExpected struct {
	Index   int                 `json:"index"`
	DayName string              `json:"dayName"`
	Slots   []gzclpSlotExpected `json:"slots"`
}

type gzclpFixture struct {
	Config       map[string]any     `json:"config"`
	ExpectedRows []gzclpRowExpected `json:"expectedRows"`
}

func buildGZCLPDef() ProgramDefinition {
	// Manually constructed from the seed file (gzclp.ts)
	t1Stages := []StageDefinition{
		{Sets: 5, Reps: 3, Amrap: true},
		{Sets: 6, Reps: 2, Amrap: true},
		{Sets: 10, Reps: 1, Amrap: true},
	}
	t2Stages := []StageDefinition{
		{Sets: 3, Reps: 10},
		{Sets: 3, Reps: 8},
		{Sets: 3, Reps: 6},
	}
	t3Stages := []StageDefinition{
		{Sets: 3, Reps: 25, Amrap: true},
	}

	addWeight := &ProgressionRule{Type: "add_weight"}
	advanceStage := &ProgressionRule{Type: "advance_stage"}
	noChange := &ProgressionRule{Type: "no_change"}
	deload10 := &ProgressionRule{Type: "deload_percent", Percent: ptr(10.0)}
	addWeight15 := &ProgressionRule{Type: "add_weight_reset_stage", Amount: ptr(15.0)}

	days := []WorkoutDay{
		{
			Name: "Día 1",
			Slots: []ExerciseSlot{
				{ID: "d1-t1", ExerciseID: "squat", Tier: "t1", Stages: t1Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: deload10, StartWeightKey: "squat"},
				{ID: "d1-t2", ExerciseID: "bench", Tier: "t2", Stages: t2Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: addWeight15, StartWeightKey: "bench", StartWeightMultiplier: ptr(0.65)},
				{ID: "latpulldown-t3", ExerciseID: "latpulldown", Tier: "t3", Stages: t3Stages, OnSuccess: addWeight, OnUndefined: noChange, OnMidStageFail: noChange, OnFinalStageFail: noChange, StartWeightKey: "latpulldown"},
			},
		},
		{
			Name: "Día 2",
			Slots: []ExerciseSlot{
				{ID: "d2-t1", ExerciseID: "ohp", Tier: "t1", Stages: t1Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: deload10, StartWeightKey: "ohp"},
				{ID: "d2-t2", ExerciseID: "deadlift", Tier: "t2", Stages: t2Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: addWeight15, StartWeightKey: "deadlift", StartWeightMultiplier: ptr(0.65)},
				{ID: "dbrow-t3", ExerciseID: "dbrow", Tier: "t3", Stages: t3Stages, OnSuccess: addWeight, OnUndefined: noChange, OnMidStageFail: noChange, OnFinalStageFail: noChange, StartWeightKey: "dbrow"},
			},
		},
		{
			Name: "Día 3",
			Slots: []ExerciseSlot{
				{ID: "d3-t1", ExerciseID: "bench", Tier: "t1", Stages: t1Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: deload10, StartWeightKey: "bench"},
				{ID: "d3-t2", ExerciseID: "squat", Tier: "t2", Stages: t2Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: addWeight15, StartWeightKey: "squat", StartWeightMultiplier: ptr(0.65)},
				{ID: "latpulldown-t3", ExerciseID: "latpulldown", Tier: "t3", Stages: t3Stages, OnSuccess: addWeight, OnUndefined: noChange, OnMidStageFail: noChange, OnFinalStageFail: noChange, StartWeightKey: "latpulldown"},
			},
		},
		{
			Name: "Día 4",
			Slots: []ExerciseSlot{
				{ID: "d4-t1", ExerciseID: "deadlift", Tier: "t1", Stages: t1Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: deload10, StartWeightKey: "deadlift"},
				{ID: "d4-t2", ExerciseID: "ohp", Tier: "t2", Stages: t2Stages, OnSuccess: addWeight, OnMidStageFail: advanceStage, OnFinalStageFail: addWeight15, StartWeightKey: "ohp", StartWeightMultiplier: ptr(0.65)},
				{ID: "dbrow-t3", ExerciseID: "dbrow", Tier: "t3", Stages: t3Stages, OnSuccess: addWeight, OnUndefined: noChange, OnMidStageFail: noChange, OnFinalStageFail: noChange, StartWeightKey: "dbrow"},
			},
		},
	}

	return ProgramDefinition{
		ID:              "gzclp",
		Name:            "GZCLP",
		TotalWorkouts:   90,
		Days:            days,
		Exercises: map[string]ExerciseEntry{
			"squat":      {Name: "Sentadilla"},
			"bench":      {Name: "Press Banca"},
			"deadlift":   {Name: "Peso Muerto"},
			"ohp":        {Name: "Press Militar"},
			"latpulldown": {Name: "Jalón al Pecho"},
			"dbrow":      {Name: "Remo"},
		},
		WeightIncrements: map[string]float64{
			"squat":      5,
			"bench":      2.5,
			"deadlift":   5,
			"ohp":        2.5,
			"latpulldown": 2.5,
			"dbrow":      2.5,
		},
	}
}

func TestGZCLPFixture(t *testing.T) {
	data, err := os.ReadFile("testdata/gzclp_expected.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	var fixture gzclpFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("unmarshal fixture: %v", err)
	}

	def := buildGZCLPDef()
	rows := ComputeGenericProgram(def, fixture.Config, nil)

	for _, exp := range fixture.ExpectedRows {
		if exp.Index >= len(rows) {
			t.Errorf("fixture row %d out of bounds (got %d rows)", exp.Index, len(rows))
			continue
		}
		row := rows[exp.Index]
		if row.DayName != exp.DayName {
			t.Errorf("row %d: dayName = %q, want %q", exp.Index, row.DayName, exp.DayName)
		}
		if len(row.Slots) != len(exp.Slots) {
			t.Errorf("row %d: slot count = %d, want %d", exp.Index, len(row.Slots), len(exp.Slots))
			continue
		}
		for si, es := range exp.Slots {
			got := row.Slots[si]
			if got.SlotID != es.SlotID {
				t.Errorf("row %d slot %d: slotId = %q, want %q", exp.Index, si, got.SlotID, es.SlotID)
			}
			if got.ExerciseID != es.ExerciseID {
				t.Errorf("row %d slot %d: exerciseId = %q, want %q", exp.Index, si, got.ExerciseID, es.ExerciseID)
			}
			if got.Weight != es.Weight {
				t.Errorf("row %d slot %d (%s): weight = %v, want %v", exp.Index, si, es.SlotID, got.Weight, es.Weight)
			}
			if got.Stage != es.Stage {
				t.Errorf("row %d slot %d (%s): stage = %v, want %v", exp.Index, si, es.SlotID, got.Stage, es.Stage)
			}
		}
	}
}
