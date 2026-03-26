package engine

import (
	"math"
	"strconv"
)

// RoundToNearestHalf rounds value to the nearest 0.5. Returns 0 for negative/NaN/Inf.
func RoundToNearestHalf(value float64) float64 {
	rounded := math.Round(value*2) / 2
	if math.IsNaN(rounded) || math.IsInf(rounded, 0) || rounded < 0 {
		return 0
	}
	return rounded
}

// RoundToNearest rounds value to the nearest multiple of step.
// Falls back to RoundToNearestHalf if step <= 0 or non-finite.
func RoundToNearest(value, step float64) float64 {
	if step <= 0 || math.IsInf(step, 0) || math.IsNaN(step) {
		return RoundToNearestHalf(value)
	}
	rounded := math.Round(value/step) * step
	if math.IsNaN(rounded) || math.IsInf(rounded, 0) || rounded < 0 {
		return 0
	}
	// Float artifact sanitization (e.g. 67.49999... -> 67.5)
	return math.Round(rounded*1000) / 1000
}

// ConfigToNum extracts a numeric value from a config map by key.
// Handles float64, string, or missing — returns 0 for anything else.
func ConfigToNum(config map[string]any, key string) float64 {
	v, ok := config[key]
	if !ok {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
			return 0
		}
		return f
	default:
		return 0
	}
}

// boolPtr returns a pointer to b, or nil when b is false.
// Used to populate optional bool fields that follow pointer+omitempty JSON convention.
func boolPtr(b bool) *bool {
	if !b {
		return nil
	}
	return &b
}

// slotState tracks mutable progression state for a single slot during replay.
type slotState struct {
	weight      float64
	stage       int
	everChanged bool
}

// tierRoleMap maps tier to role for legacy programs (GZCLP, Nivel7).
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

// deriveResultFromSetLogsDouble derives result using double_progression thresholds.
// Returns nil if setLogs empty (fallback to explicit result).
func deriveResultFromSetLogsDouble(logs []SetLogEntry, repRangeTop, repRangeBottom int) *string {
	if len(logs) == 0 {
		return nil
	}
	allTop := true
	for _, s := range logs {
		if s.Reps < repRangeTop {
			allTop = false
		}
	}
	if allTop {
		r := "success"
		return &r
	}
	for _, s := range logs {
		if s.Reps < repRangeBottom {
			r := "fail"
			return &r
		}
	}
	return nil
}

// deriveResultFromSetLogsSimple derives result via simple pass/fail vs targetReps.
func deriveResultFromSetLogsSimple(logs []SetLogEntry, targetReps int) *string {
	if len(logs) == 0 {
		return nil
	}
	for _, s := range logs {
		if s.Reps < targetReps {
			r := "fail"
			return &r
		}
	}
	r := "success"
	return &r
}

// deriveSlotResult derives the effective result for a slot.
// Falls back to slotResult.Result when setLogs are absent or derivation is nil.
func deriveSlotResult(slot ExerciseSlot, slotResult SlotResult, targetReps int) *string {
	if len(slotResult.SetLogs) == 0 {
		return slotResult.Result
	}

	logs := slotResult.SetLogs
	if slot.ProgressionSetIndex != nil {
		idx := *slot.ProgressionSetIndex
		if idx < len(slotResult.SetLogs) {
			logs = slotResult.SetLogs[idx : idx+1]
		}
	}

	if slot.OnSuccess != nil && slot.OnSuccess.Type == "double_progression" {
		var top, bottom int
		if slot.OnSuccess.RepRangeTop != nil {
			top = *slot.OnSuccess.RepRangeTop
		}
		if slot.OnSuccess.RepRangeBottom != nil {
			bottom = *slot.OnSuccess.RepRangeBottom
		}
		derived := deriveResultFromSetLogsDouble(logs, top, bottom)
		if derived != nil {
			return derived
		}
		return slotResult.Result
	}

	derived := deriveResultFromSetLogsSimple(logs, targetReps)
	if derived != nil {
		return derived
	}
	return slotResult.Result
}

// applyRule applies a single progression rule to the slot state.
func applyRule(rule ProgressionRule, state slotState, increment float64, maxStageIdx int, roundingStep float64) slotState {
	switch rule.Type {
	case "add_weight":
		return slotState{weight: state.weight + increment, stage: state.stage, everChanged: state.everChanged}
	case "advance_stage":
		newStage := state.stage + 1
		if newStage > maxStageIdx {
			newStage = maxStageIdx
		}
		return slotState{weight: state.weight, stage: newStage, everChanged: state.everChanged}
	case "advance_stage_add_weight":
		newStage := state.stage + 1
		if newStage > maxStageIdx {
			newStage = maxStageIdx
		}
		return slotState{weight: state.weight + increment, stage: newStage, everChanged: state.everChanged}
	case "deload_percent":
		pct := 0.0
		if rule.Percent != nil {
			pct = *rule.Percent
		}
		return slotState{
			weight:      RoundToNearest(state.weight*(1-pct/100), roundingStep),
			stage:       0,
			everChanged: state.everChanged,
		}
	case "add_weight_reset_stage":
		amt := 0.0
		if rule.Amount != nil {
			amt = *rule.Amount
		}
		return slotState{
			weight:      RoundToNearest(state.weight+amt, roundingStep),
			stage:       0,
			everChanged: state.everChanged,
		}
	case "no_change":
		return state
	case "update_tm":
		// Handled inline in applySlotProgression (needs tmState access). No-op here.
		return state
	case "double_progression":
		// Increase weight (same as add_weight); set-log derivation happens in snapshot.
		return slotState{weight: state.weight + increment, stage: state.stage, everChanged: state.everChanged}
	default:
		return state
	}
}

// applyUpdateTm handles the update_tm rule mutating tmState and slotState.
func applyUpdateTm(
	rule ProgressionRule,
	slot ExerciseSlot,
	slotResult SlotResult,
	tmState map[string]float64,
	slotStates map[string]slotState,
	state slotState,
	roundingStep float64,
) {
	if slot.TrainingMaxKey == "" {
		// update_tm requires trainingMaxKey — treat as no-op defensively
		slotStates[slot.ID] = state
		return
	}
	minAmrapReps := 0
	if rule.MinAmrapReps != nil {
		minAmrapReps = *rule.MinAmrapReps
	}
	amount := 0.0
	if rule.Amount != nil {
		amount = *rule.Amount
	}

	if slotResult.AmrapReps != nil && *slotResult.AmrapReps >= minAmrapReps {
		tmState[slot.TrainingMaxKey] = RoundToNearest(tmState[slot.TrainingMaxKey]+amount, roundingStep)
		slotStates[slot.ID] = slotState{weight: state.weight, stage: state.stage, everChanged: true}
	} else {
		slotStates[slot.ID] = state
	}
}

// applySlotProgression selects the applicable rule and applies progression.
func applySlotProgression(
	slot ExerciseSlot,
	state slotState,
	slotResult SlotResult,
	resultValue *string,
	increment float64,
	tmState map[string]float64,
	slotStates map[string]slotState,
	roundingStep float64,
) {
	maxStageIdx := len(slot.Stages) - 1

	if resultValue != nil && *resultValue == "fail" {
		var rule *ProgressionRule
		if state.stage >= maxStageIdx {
			rule = slot.OnFinalStageFail
		} else {
			rule = slot.OnMidStageFail
		}
		if rule == nil {
			slotStates[slot.ID] = state
			return
		}
		if rule.Type == "update_tm" {
			applyUpdateTm(*rule, slot, slotResult, tmState, slotStates, state, roundingStep)
			return
		}
		changesState := rule.Type != "no_change"
		nextState := applyRule(*rule, state, increment, maxStageIdx, roundingStep)
		ec := state.everChanged || changesState
		slotStates[slot.ID] = slotState{weight: nextState.weight, stage: nextState.stage, everChanged: ec}
		return
	}

	if resultValue != nil && *resultValue == "success" {
		var rule *ProgressionRule
		if state.stage >= maxStageIdx && slot.OnFinalStageSuccess != nil {
			rule = slot.OnFinalStageSuccess
		} else {
			rule = slot.OnSuccess
		}
		if rule == nil {
			slotStates[slot.ID] = state
			return
		}
		if rule.Type == "update_tm" {
			applyUpdateTm(*rule, slot, slotResult, tmState, slotStates, state, roundingStep)
			return
		}
		nextState := applyRule(*rule, state, increment, maxStageIdx, roundingStep)
		slotStates[slot.ID] = slotState{weight: nextState.weight, stage: nextState.stage, everChanged: state.everChanged}
		return
	}

	// resultValue == nil — apply onUndefined if set, else onSuccess (implicit pass)
	rule := slot.OnUndefined
	if rule == nil {
		rule = slot.OnSuccess
	}
	if rule == nil {
		slotStates[slot.ID] = state
		return
	}
	if rule.Type == "update_tm" {
		applyUpdateTm(*rule, slot, slotResult, tmState, slotStates, state, roundingStep)
		return
	}
	nextState := applyRule(*rule, state, increment, maxStageIdx, roundingStep)
	slotStates[slot.ID] = slotState{weight: nextState.weight, stage: nextState.stage, everChanged: state.everChanged}
}

// ComputeGenericProgram replays all workouts deterministically from definition + config + results.
func ComputeGenericProgram(definition ProgramDefinition, config map[string]any, results GenericResults) []GenericWorkoutRow {
	const defaultRoundingStep = 2.5
	roundingStep := ConfigToNum(config, "rounding")
	if roundingStep == 0 {
		roundingStep = defaultRoundingStep
	}

	// --- Initialize slot and TM state in a single pass ---
	slotStates := make(map[string]slotState)
	tmState := make(map[string]float64)
	for _, day := range definition.Days {
		for _, slot := range day.Slots {
			if _, exists := slotStates[slot.ID]; !exists {
				base := ConfigToNum(config, slot.StartWeightKey)
				var multiplied float64
				if slot.StartWeightMultiplier != nil {
					multiplied = RoundToNearest(base**slot.StartWeightMultiplier, roundingStep)
				} else {
					multiplied = base
				}
				offset := 0
				if slot.StartWeightOffset != nil {
					offset = *slot.StartWeightOffset
				}
				increment := definition.WeightIncrements[slot.ExerciseID]
				weight := RoundToNearest(multiplied-float64(offset)*increment, roundingStep)
				slotStates[slot.ID] = slotState{weight: weight, stage: 0, everChanged: false}
			}
			if slot.TrainingMaxKey != "" {
				if _, exists := tmState[slot.TrainingMaxKey]; !exists {
					tmState[slot.TrainingMaxKey] = ConfigToNum(config, slot.TrainingMaxKey)
				}
			}
		}
	}

	rows := make([]GenericWorkoutRow, 0, definition.TotalWorkouts)
	cycleLength := len(definition.Days)
	prevWeightByExerciseID := make(map[string]float64)

	for i := 0; i < definition.TotalWorkouts; i++ {
		day := definition.Days[i%cycleLength]
		var workoutResult map[string]SlotResult
		if results != nil {
			workoutResult = results[strconv.Itoa(i)]
		}
		if workoutResult == nil {
			workoutResult = make(map[string]SlotResult)
		}
		derivedResultsBySlotID := make(map[string]*string)

		// --- 1. Snapshot BEFORE applying progression ---
		slotRows := make([]GenericSlotRow, 0, len(day.Slots))
		workoutIsChanged := false
		for _, slot := range day.Slots {
			state := slotStates[slot.ID]
			slotResult := workoutResult[slot.ID]
			exerciseName := ""
			if ex, ok := definition.Exercises[slot.ExerciseID]; ok {
				exerciseName = ex.Name
			}
			role := resolveRole(slot.Role, slot.Tier)

			// --- Prescription-based slot (Sheiko-style %1RM) ---
			if len(slot.Prescriptions) > 0 && slot.PercentOf != "" {
				base1rm := ConfigToNum(config, slot.PercentOf)
				resolvedPrescriptions := make([]ResolvedPrescription, len(slot.Prescriptions))
				for pi, p := range slot.Prescriptions {
					resolvedPrescriptions[pi] = ResolvedPrescription{
						Percent: p.Percent,
						Sets:    p.Sets,
						Reps:    p.Reps,
						Weight:  RoundToNearest(base1rm*p.Percent/100, roundingStep),
					}
				}
				workingSet := resolvedPrescriptions[len(resolvedPrescriptions)-1]

				row := GenericSlotRow{
					SlotID:        slot.ID,
					ExerciseID:    slot.ExerciseID,
					ExerciseName:  exerciseName,
					Tier:          slot.Tier,
					Weight:        workingSet.Weight,
					Stage:         0,
					Sets:          workingSet.Sets,
					Reps:          workingSet.Reps,
					IsAmrap:       false,
					StagesCount:   1,
					Result:        slotResult.Result,
					IsChanged:     false,
					IsDeload:      false,
					Role:          role,
					Notes:         slot.Notes,
					Prescriptions: resolvedPrescriptions,
					IsGpp:         boolPtr(slot.IsGpp),
					ComplexReps:   slot.ComplexReps,
					PropagatesTo:  slot.PropagatesTo,
					IsTestSlot:    boolPtr(slot.IsTestSlot),
					IsBodyweight:  boolPtr(slot.IsBodyweight),
					SetLogs:       slotResult.SetLogs,
				}
				slotRows = append(slotRows, row)
				continue
			}

			// --- GPP slot (no weight, pass/fail only) ---
			if slot.IsGpp {
				gppStage := slot.Stages[0]

				row := GenericSlotRow{
					SlotID:       slot.ID,
					ExerciseID:   slot.ExerciseID,
					ExerciseName: exerciseName,
					Tier:         slot.Tier,
					Weight:       0,
					Stage:        0,
					Sets:         gppStage.Sets,
					Reps:         gppStage.Reps,
					IsAmrap:      false,
					StagesCount:  1,
					Result:       slotResult.Result,
					IsChanged:    false,
					IsDeload:     false,
					Role:         role,
					Notes:        slot.Notes,
					IsGpp:        boolPtr(true),
					ComplexReps:  slot.ComplexReps,
					PropagatesTo: slot.PropagatesTo,
					IsTestSlot:   boolPtr(slot.IsTestSlot),
					IsBodyweight: boolPtr(slot.IsBodyweight),
					SetLogs:      slotResult.SetLogs,
				}
				slotRows = append(slotRows, row)
				continue
			}

			// --- Standard stage-based slot ---
			stageConfig := slot.Stages[state.stage]

			// TM-derived weight or absolute weight
			weight := state.weight
			if slot.TrainingMaxKey != "" && slot.TmPercent != nil {
				weight = RoundToNearest(tmState[slot.TrainingMaxKey]**slot.TmPercent, roundingStep)
			}

			// Deload detection: weight decreased vs previous occurrence of same exercise
			prevWeight, hasPrev := prevWeightByExerciseID[slot.ExerciseID]
			isDeload := hasPrev && weight > 0 && weight < prevWeight
			if weight > 0 {
				prevWeightByExerciseID[slot.ExerciseID] = weight
			}

			// Auto-derive result from setLogs
			derivedResult := deriveSlotResult(slot, slotResult, stageConfig.Reps)
			derivedResultsBySlotID[slot.ID] = derivedResult

			// Derive AMRAP reps from last setLog when isAmrap
			var amrapReps *int
			if stageConfig.Amrap && len(slotResult.SetLogs) > 0 {
				reps := slotResult.SetLogs[len(slotResult.SetLogs)-1].Reps
				amrapReps = &reps
			} else {
				amrapReps = slotResult.AmrapReps
			}

			row := GenericSlotRow{
				SlotID:       slot.ID,
				ExerciseID:   slot.ExerciseID,
				ExerciseName: exerciseName,
				Tier:         slot.Tier,
				Weight:       weight,
				Stage:        state.stage,
				Sets:         stageConfig.Sets,
				Reps:         stageConfig.Reps,
				RepsMax:      stageConfig.RepsMax,
				IsAmrap:      stageConfig.Amrap,
				StagesCount:  len(slot.Stages),
				Result:       derivedResult,
				AmrapReps:    amrapReps,
				Rpe:          slotResult.Rpe,
				IsChanged:    state.everChanged,
				IsDeload:     isDeload,
				Role:         role,
				Notes:        slot.Notes,
				PropagatesTo: slot.PropagatesTo,
				IsTestSlot:   boolPtr(slot.IsTestSlot),
				IsBodyweight: boolPtr(slot.IsBodyweight),
				SetLogs:      slotResult.SetLogs,
			}
			slotRows = append(slotRows, row)
			if row.IsChanged {
				workoutIsChanged = true
			}
		}

		rows = append(rows, GenericWorkoutRow{
			Index:     i,
			DayName:   day.Name,
			Slots:     slotRows,
			IsChanged: workoutIsChanged,
		})

		// --- 2. Apply progression AFTER snapshot ---
		for _, slot := range day.Slots {
			// Prescription and GPP slots don't use stage-based progression
			if len(slot.Prescriptions) > 0 || slot.IsGpp {
				continue
			}
			state := slotStates[slot.ID]
			slotResult := workoutResult[slot.ID]
			resultValue := derivedResultsBySlotID[slot.ID]
			increment := definition.WeightIncrements[slot.ExerciseID]
			applySlotProgression(slot, state, slotResult, resultValue, increment, tmState, slotStates, roundingStep)
		}
	}

	return rows
}
