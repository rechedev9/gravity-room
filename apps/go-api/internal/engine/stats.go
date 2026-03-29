package engine

import (
	"fmt"
	"math"
	"strconv"
	"time"
)

// esMonths maps Go month index (0-based) to Spanish abbreviations.
var esMonths = [12]string{"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"}

// FormatDateLabel formats an ISO date string into a short es-ES label.
// Same year: "12 feb"; prior year: "12 feb 24".
// Returns nil if the date string is invalid.
func FormatDateLabel(dateStr string) *string {
	var t time.Time
	var err error

	t, err = time.Parse(time.RFC3339, dateStr)
	if err != nil {
		t, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			return nil
		}
	}

	month := esMonths[t.Month()-1]
	var label string
	if t.Year() == time.Now().Year() {
		label = fmt.Sprintf("%d %s", t.Day(), month)
	} else {
		label = fmt.Sprintf("%d %s %s", t.Day(), month, t.Format("06"))
	}
	return &label
}

// computeSlotVolume computes total volume (kg) for a single slot.
// Uses setLogs when available, falls back to weight*sets*reps.
func computeSlotVolume(slot GenericSlotRow) float64 {
	if len(slot.SetLogs) > 0 {
		var total float64
		for _, s := range slot.SetLogs {
			w := slot.Weight
			if s.Weight != nil {
				w = *s.Weight
			}
			total += w * float64(s.Reps)
		}
		return total
	}
	return slot.Weight * float64(slot.Sets) * float64(slot.Reps)
}

// ExtractAllGenericStats performs a single-pass extraction of all stats from workout rows.
// exerciseIDs must be provided to pre-populate the chartData/rpeData/amrapData maps.
func ExtractAllGenericStats(exerciseIDs []string, rows []GenericWorkoutRow, resultTimestamps map[string]string) AllGenericStats {
	chartData := make(map[string][]ChartDataPoint, len(exerciseIDs))
	rpeData := make(map[string][]RpeDataPoint, len(exerciseIDs))
	amrapData := make(map[string][]AmrapDataPoint, len(exerciseIDs))
	volumeData := make([]VolumeDataPoint, 0)

	for _, id := range exerciseIDs {
		chartData[id] = []ChartDataPoint{}
		rpeData[id] = []RpeDataPoint{}
		amrapData[id] = []AmrapDataPoint{}
	}

	for _, row := range rows {
		workoutIndexStr := strconv.Itoa(row.Index)
		var date *string
		if resultTimestamps != nil {
			if ts, ok := resultTimestamps[workoutIndexStr]; ok {
				date = FormatDateLabel(ts)
			}
		}
		workoutNum := row.Index + 1

		var volumeKg float64

		for _, slot := range row.Slots {
			// Chart data — always accumulate
			if pts, ok := chartData[slot.ExerciseID]; ok {
				stage := slot.Stage + 1
				chartData[slot.ExerciseID] = append(pts, ChartDataPoint{
					Workout:   workoutNum,
					Weight:    slot.Weight,
					Stage:     stage,
					Result:    slot.Result,
					Date:      date,
					AmrapReps: slot.AmrapReps,
				})
			}

			// RPE data — only when rpe is defined
			if slot.Rpe != nil {
				if pts, ok := rpeData[slot.ExerciseID]; ok {
					rpeData[slot.ExerciseID] = append(pts, RpeDataPoint{
						Workout: workoutNum,
						Rpe:     *slot.Rpe,
						Date:    date,
					})
				}
			}

			// AMRAP data — only when isAmrap, amrapReps defined and > 0
			if slot.IsAmrap && slot.AmrapReps != nil && *slot.AmrapReps > 0 {
				if pts, ok := amrapData[slot.ExerciseID]; ok {
					amrapData[slot.ExerciseID] = append(pts, AmrapDataPoint{
						Workout: workoutNum,
						Reps:    *slot.AmrapReps,
						Weight:  slot.Weight,
						Date:    date,
					})
				}
			}

			// Volume accumulation — only successful slots
			if slot.Result != nil && *slot.Result == "success" {
				volumeKg += computeSlotVolume(slot)
			}
		}

		if volumeKg > 0 {
			volumeData = append(volumeData, VolumeDataPoint{
				Workout:  workoutNum,
				VolumeKg: math.Round(volumeKg),
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
