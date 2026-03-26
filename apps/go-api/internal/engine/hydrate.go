package engine

import (
	"encoding/json"
	"fmt"
)

// HydrateProgramDefinition injects exercise names into a raw program definition JSON blob.
// It collects exerciseIds from days→slots, looks them up in exerciseRows,
// and injects names into the exercises map before unmarshalling into ProgramDefinition.
func HydrateProgramDefinition(defRaw []byte, exerciseRows []ExerciseRow) (ProgramDefinition, error) {
	// 1. Unmarshal to map[string]any for surgical modification
	var rawMap map[string]any
	if err := json.Unmarshal(defRaw, &rawMap); err != nil {
		return ProgramDefinition{}, fmt.Errorf("hydrate: unmarshal raw: %w", err)
	}

	// 2. Build id→name map from exerciseRows
	nameByID := make(map[string]string, len(exerciseRows))
	for _, row := range exerciseRows {
		nameByID[row.ID] = row.Name
	}

	// 3. Collect exerciseIds from days→slots
	exerciseIDsNeeded := make(map[string]struct{})
	if days, ok := rawMap["days"].([]any); ok {
		for _, dayRaw := range days {
			day, ok := dayRaw.(map[string]any)
			if !ok {
				continue
			}
			slots, ok := day["slots"].([]any)
			if !ok {
				continue
			}
			for _, slotRaw := range slots {
				slot, ok := slotRaw.(map[string]any)
				if !ok {
					continue
				}
				if eid, ok := slot["exerciseId"].(string); ok {
					exerciseIDsNeeded[eid] = struct{}{}
				}
			}
		}
	}

	// 4. Check all needed exercise IDs are present
	for eid := range exerciseIDsNeeded {
		if _, ok := nameByID[eid]; !ok {
			return ProgramDefinition{}, fmt.Errorf("hydrate: exercise %q not found in exerciseRows", eid)
		}
	}

	// 5. Inject names into exercises map
	exercises, _ := rawMap["exercises"].(map[string]any)
	if exercises == nil {
		exercises = make(map[string]any)
	}
	for eid := range exerciseIDsNeeded {
		exercises[eid] = map[string]any{"name": nameByID[eid]}
	}
	rawMap["exercises"] = exercises

	// 6. Re-marshal and unmarshal into ProgramDefinition
	patched, err := json.Marshal(rawMap)
	if err != nil {
		return ProgramDefinition{}, fmt.Errorf("hydrate: re-marshal: %w", err)
	}

	var def ProgramDefinition
	if err := json.Unmarshal(patched, &def); err != nil {
		return ProgramDefinition{}, fmt.Errorf("hydrate: unmarshal definition: %w", err)
	}

	return def, nil
}
