package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed data/exercises-expanded.json
var exercisesExpandedJSON []byte

// muscleGroupMap maps free-exercise-db muscle names to the 8 existing IDs.
var muscleGroupMap = map[string]string{
	"abdominals":  "core",
	"adductors":   "legs",
	"abductors":   "legs",
	"biceps":      "arms",
	"calves":      "calves",
	"chest":       "chest",
	"forearms":    "arms",
	"glutes":      "legs",
	"hamstrings":  "legs",
	"lats":        "back",
	"lower back":  "back",
	"middle back": "back",
	"neck":        "shoulders",
	"quadriceps":  "legs",
	"shoulders":   "shoulders",
	"traps":       "back",
	"triceps":     "arms",
}

type expandedExerciseRaw struct {
	ID               string   `json:"id"`
	NameEs           string   `json:"nameEs"`
	Force            *string  `json:"force"`
	Level            string   `json:"level"`
	Mechanic         *string  `json:"mechanic"`
	Equipment        *string  `json:"equipment"`
	PrimaryMuscles   []string `json:"primaryMuscles"`
	SecondaryMuscles []string `json:"secondaryMuscles"`
	Category         string   `json:"category"`
}

func seedExercisesExpanded(ctx context.Context, pool *pgxpool.Pool) error {
	var raw []expandedExerciseRaw
	if err := json.Unmarshal(exercisesExpandedJSON, &raw); err != nil {
		return fmt.Errorf("unmarshal exercises-expanded.json: %w", err)
	}

	const batchSize = 100
	for i := 0; i < len(raw); i += batchSize {
		end := i + batchSize
		if end > len(raw) {
			end = len(raw)
		}
		batch := raw[i:end]

		var b strings.Builder
		b.WriteString(`INSERT INTO exercises (id, name, muscle_group_id, equipment, is_compound, is_preset, created_by, force, level, mechanic, category, secondary_muscles) VALUES `)
		args := make([]any, 0, len(batch)*10)

		for j, ex := range batch {
			if len(ex.PrimaryMuscles) == 0 {
				return fmt.Errorf("exercise %q has no primaryMuscles", ex.ID)
			}
			mgID, ok := muscleGroupMap[ex.PrimaryMuscles[0]]
			if !ok {
				return fmt.Errorf("exercise %q has unmapped muscle group: %q", ex.ID, ex.PrimaryMuscles[0])
			}

			isCompound := ex.Mechanic != nil && *ex.Mechanic == "compound"

			var secondaryMuscles []string
			for _, m := range ex.SecondaryMuscles {
				if mapped, ok := muscleGroupMap[m]; ok {
					secondaryMuscles = append(secondaryMuscles, mapped)
				}
			}

			if j > 0 {
				b.WriteString(", ")
			}
			base := j*10 + 1
			fmt.Fprintf(&b, "($%d, $%d, $%d, $%d, $%d, true, NULL, $%d, $%d, $%d, $%d, $%d)",
				base, base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9)
			args = append(args, ex.ID, ex.NameEs, mgID, ex.Equipment, isCompound,
				ex.Force, ex.Level, ex.Mechanic, ex.Category, secondaryMuscles)
		}
		b.WriteString(" ON CONFLICT DO NOTHING")

		if _, err := pool.Exec(ctx, b.String(), args...); err != nil {
			return fmt.Errorf("insert expanded exercises batch %d: %w", i/batchSize, err)
		}
	}
	return nil
}
