package engine

// ComputeGraduationTargets computes graduation weight targets based on bodyweight and gender.
// Male: 100% BW, Female: 70% BW, rounded to nearest rounding.
// Returns targets for squat (3 reps), bench (1 rep), deadlift (10 reps).
func ComputeGraduationTargets(bodyweight float64, gender string, rounding float64) GraduationTargets {
	multiplier := 1.0
	if gender == "female" {
		multiplier = 0.7
	}
	targetWeight := RoundToNearest(bodyweight*multiplier, rounding)
	return GraduationTargets{
		Squat:    targetWeight,
		Bench:    targetWeight,
		Deadlift: targetWeight,
	}
}

// CheckGraduationCriterion checks if a single lift criterion is met.
// squat: reps >= 3 AND weight >= targetWeight
// bench: reps >= 1 AND weight >= targetWeight
// deadlift: reps >= 10 AND weight >= targetWeight
func CheckGraduationCriterion(exercise string, weight, reps, targetWeight float64) bool {
	if weight < targetWeight {
		return false
	}
	switch exercise {
	case "squat":
		return reps >= 3
	case "bench":
		return reps >= 1
	case "deadlift":
		return reps >= 10
	default:
		return false
	}
}

// ComputeEpley1RM computes the Epley 1RM estimate: weight * (1 + reps/30).
// Returns 0 if weight or reps are <= 0.
func ComputeEpley1RM(weight, reps float64) float64 {
	if weight <= 0 || reps <= 0 {
		return 0
	}
	return weight * (1 + reps/30)
}

// SuggestNextWeight suggests the next session weight based on history.
// - No history (prev nil): return nil
// - Only one session (secondPrev nil): prev + rounding
// - If increased last time (prev > secondPrev): maintain (consolidate)
// - If maintained or decreased: increase by rounding
func SuggestNextWeight(prev, secondPrev *float64, rounding float64) *float64 {
	if prev == nil {
		return nil
	}
	if secondPrev == nil {
		v := RoundToNearest(*prev+rounding, rounding)
		return &v
	}
	if *prev > *secondPrev {
		return prev
	}
	v := RoundToNearest(*prev+rounding, rounding)
	return &v
}
