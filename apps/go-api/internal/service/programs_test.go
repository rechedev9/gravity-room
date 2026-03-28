package service

import (
	"testing"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/engine"
)

func TestValidateImportConfigRejectsInvalidTypes(t *testing.T) {
	_, err := validateImportConfig(map[string]any{"bad": true})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*apierror.ApiError)
	if !ok {
		t.Fatalf("expected ApiError, got %T", err)
	}
	if apiErr.Code != apierror.CodeInvalidData {
		t.Fatalf("code = %s, want %s", apiErr.Code, apierror.CodeInvalidData)
	}
}

func TestValidateImportedDataRejectsUnknownSlot(t *testing.T) {
	def := engine.ProgramDefinition{
		TotalWorkouts: 4,
		Days: []engine.WorkoutDay{{
			Name: "A",
			Slots: []engine.ExerciseSlot{{
				ID:         "slot-1",
				ExerciseID: "squat",
				Stages:     []engine.StageDefinition{{Sets: 3, Reps: 5}},
			}},
		}},
	}

	_, _, err := validateImportedData(map[string]any{
		"results": map[string]any{
			"0": map[string]any{
				"missing-slot": map[string]any{"result": "success"},
			},
		},
		"undoHistory": []any{},
	}, def)
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*apierror.ApiError)
	if !ok {
		t.Fatalf("expected ApiError, got %T", err)
	}
	if apiErr.Code != apierror.CodeInvalidData {
		t.Fatalf("code = %s, want %s", apiErr.Code, apierror.CodeInvalidData)
	}
}

func TestValidateProgramDefinitionRejectsEmptyDays(t *testing.T) {
	err := validateProgramDefinition(engine.ProgramDefinition{})
	if err == nil {
		t.Fatal("expected error")
	}
}
