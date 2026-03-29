package service

import (
	"testing"

	"github.com/reche/gravity-room/apps/go-api/internal/engine"
)

// minimalSlot builds a slot with all required progression rules populated.
func minimalSlot(id string) engine.ExerciseSlot {
	noChange := &engine.ProgressionRule{Type: "no_change"}
	return engine.ExerciseSlot{
		ID:              id,
		ExerciseID:      "ex",
		Tier:            "t1",
		StartWeightKey:  "ex",
		Stages:          []engine.StageDefinition{{Sets: 5, Reps: 5}},
		OnSuccess:       &engine.ProgressionRule{Type: "add_weight"},
		OnMidStageFail:  noChange,
		OnFinalStageFail: noChange,
	}
}

// minimalDef builds a valid 1-day, 1-slot, 1-workout definition.
func minimalDef() engine.ProgramDefinition {
	return engine.ProgramDefinition{
		ID:              "test",
		Name:            "Test",
		TotalWorkouts:   1,
		WorkoutsPerWeek: 1,
		CycleLength:     1,
		WeightIncrements: map[string]float64{"ex": 5},
		Exercises:       map[string]engine.ExerciseEntry{"ex": {Name: "Exercise"}},
		Days: []engine.WorkoutDay{
			{Name: "Day 1", Slots: []engine.ExerciseSlot{minimalSlot("slot1")}},
		},
	}
}

func TestValidatePreviewDefinition_Valid(t *testing.T) {
	if err := validatePreviewDefinition(minimalDef()); err != nil {
		t.Errorf("unexpected error for valid definition: %v", err)
	}
}

func TestValidatePreviewDefinition_NoDays(t *testing.T) {
	def := minimalDef()
	def.Days = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for definition with no days, got nil")
	}
}

func TestValidatePreviewDefinition_NoSlots(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for day with no slots, got nil")
	}
}

func TestValidatePreviewDefinition_NoStages(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].Stages = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for slot with no stages, got nil")
	}
}

func TestValidatePreviewDefinition_MissingOnSuccess(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnSuccess = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for slot missing onSuccess, got nil")
	}
}

func TestValidatePreviewDefinition_MissingOnMidStageFail(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnMidStageFail = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for slot missing onMidStageFail, got nil")
	}
}

func TestValidatePreviewDefinition_MissingOnFinalStageFail(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnFinalStageFail = nil
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for slot missing onFinalStageFail, got nil")
	}
}

func TestValidatePreviewDefinition_UnknownRuleType(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnSuccess = &engine.ProgressionRule{Type: "unknown_rule"}
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for unknown rule type in onSuccess, got nil")
	}
}

func TestValidatePreviewDefinition_UnknownOnUndefinedType(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnUndefined = &engine.ProgressionRule{Type: "bad_type"}
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for unknown rule type in onUndefined, got nil")
	}
}

func TestValidatePreviewDefinition_UnknownOnFinalStageSuccessType(t *testing.T) {
	def := minimalDef()
	def.Days[0].Slots[0].OnFinalStageSuccess = &engine.ProgressionRule{Type: "bad_type"}
	if err := validatePreviewDefinition(def); err == nil {
		t.Error("expected error for unknown rule type in onFinalStageSuccess, got nil")
	}
}

func TestValidatePreviewDefinition_GppSlotSkipsRuleCheck(t *testing.T) {
	def := minimalDef()
	slot := def.Days[0].Slots[0]
	slot.IsGpp = true
	slot.OnSuccess = nil   // GPP slots may omit progression rules
	slot.OnMidStageFail = nil
	slot.OnFinalStageFail = nil
	def.Days[0].Slots[0] = slot
	if err := validatePreviewDefinition(def); err != nil {
		t.Errorf("GPP slot should skip rule validation, got: %v", err)
	}
}

func TestResolvePreviewConfig_WeightDefault(t *testing.T) {
	def := minimalDef()
	def.ConfigFields = []engine.ConfigField{
		{Key: "ex", Type: "weight"},
	}
	resolved := ResolvePreviewConfig(def, nil)
	if v, ok := resolved["ex"]; !ok || v != 0.0 {
		t.Errorf("expected weight default 0.0, got %v (ok=%v)", v, ok)
	}
}

func TestResolvePreviewConfig_SelectDefault(t *testing.T) {
	def := minimalDef()
	def.ConfigFields = []engine.ConfigField{
		{Key: "variant", Type: "select", Options: []engine.ConfigOption{
			{Label: "Option A", Value: "a"},
			{Label: "Option B", Value: "b"},
		}},
	}
	resolved := ResolvePreviewConfig(def, nil)
	if v, ok := resolved["variant"]; !ok || v != "a" {
		t.Errorf("expected select default \"a\", got %v (ok=%v)", v, ok)
	}
}

