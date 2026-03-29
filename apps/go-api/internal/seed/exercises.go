package seed

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type exercise struct {
	ID           string
	Name         string
	MuscleGroup  string
	Equipment    *string
	IsCompound   bool
}

func strPtr(s string) *string { return &s }

//nolint:funlen // static seed data
var canonicalExercises = []exercise{
	// Shared main lifts
	{ID: "squat", Name: "Sentadilla", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench", Name: "Press Banca", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift", Name: "Peso Muerto", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "ohp", Name: "Press Militar", MuscleGroup: "shoulders", Equipment: strPtr("barbell"), IsCompound: true},

	// GZCLP
	{ID: "latpulldown", Name: "Jalón al Pecho", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "dbrow", Name: "Remo con Mancuernas", MuscleGroup: "back", Equipment: strPtr("dumbbell"), IsCompound: true},

	// PPL 5/3/1
	{ID: "pullup", Name: "Dominadas", MuscleGroup: "back", Equipment: strPtr("bodyweight"), IsCompound: true},
	{ID: "lat_pulldown", Name: "Jalon al Pecho", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "seated_row", Name: "Remo Sentado", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: true},
	{ID: "face_pull", Name: "Face Pull", MuscleGroup: "shoulders", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "hammer_curl", Name: "Curl Martillo", MuscleGroup: "arms", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "incline_curl", Name: "Curl Inclinado", MuscleGroup: "arms", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "bent_over_row", Name: "Remo con Barra", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "incline_row", Name: "Remo Inclinado", MuscleGroup: "back", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "lying_bicep_curl", Name: "Curl Tumbado", MuscleGroup: "arms", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "incline_db_press", Name: "Press Inclinado Mancuernas", MuscleGroup: "chest", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "triceps_pushdown", Name: "Extension Triceps Polea", MuscleGroup: "arms", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "triceps_extension", Name: "Extension Triceps", MuscleGroup: "arms", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "lateral_raise", Name: "Elevaciones Laterales", MuscleGroup: "shoulders", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "barbell_rdl", Name: "RDL con Barra", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "dumbbell_rdl", Name: "RDL con Mancuernas", MuscleGroup: "legs", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "bulgarian_split_squat", Name: "Zancada Bulgara", MuscleGroup: "legs", Equipment: strPtr("dumbbell"), IsCompound: true}, //nolint:misspell // Spanish
	{ID: "cable_pull_through", Name: "Pull Through en Polea", MuscleGroup: "legs", Equipment: strPtr("cable"), IsCompound: true},
	{ID: "standing_calf_raise", Name: "Gemelo de Pie", MuscleGroup: "calves", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "seated_leg_curl", Name: "Curl Femoral Sentado", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},

	// Nivel 7
	{ID: "press_mil", Name: "Press Militar", MuscleGroup: "shoulders", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "press_franc", Name: "Press Francés", MuscleGroup: "arms", Equipment: strPtr("barbell"), IsCompound: false},
	{ID: "ext_polea", Name: "Extensión Polea", MuscleGroup: "arms", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "elev_lat", Name: "Elevaciones Laterales", MuscleGroup: "shoulders", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "elev_post", Name: "Elevaciones Posteriores", MuscleGroup: "shoulders", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "remo_bar", Name: "Remo con Barra", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "jalon", Name: "Jalón al Pecho", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "gemelo_pie", Name: "Gemelo de Pie", MuscleGroup: "calves", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "gemelo_sent", Name: "Gemelo Sentado", MuscleGroup: "calves", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "apert", Name: "Aperturas", MuscleGroup: "chest", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "cruces", Name: "Cruces en Polea", MuscleGroup: "chest", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "curl_bar", Name: "Curl con Barra", MuscleGroup: "arms", Equipment: strPtr("barbell"), IsCompound: false},
	{ID: "curl_alt", Name: "Curl Alterno", MuscleGroup: "arms", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "curl_mart", Name: "Curl Martillo", MuscleGroup: "arms", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "prensa", Name: "Prensa", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "ext_quad", Name: "Extensión Cuádriceps", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "curl_fem", Name: "Curl Femoral", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "hip_thrust", Name: "Hip Thrust", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "zancadas", Name: "Zancadas", MuscleGroup: "legs", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "leg_press_gem", Name: "Prensa Gemelo", MuscleGroup: "calves", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "elev_front", Name: "Elevaciones Frontales", MuscleGroup: "shoulders", Equipment: strPtr("dumbbell"), IsCompound: false},

	// PPL A/B
	{ID: "bench_machine", Name: "Press Banca en Maquina", MuscleGroup: "chest", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "incline_press_smith", Name: "Press Inclinado en Smith", MuscleGroup: "chest", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "pec_deck", Name: "Pec Deck", MuscleGroup: "chest", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "incline_machine_press", Name: "Press Inclinado en Maquina", MuscleGroup: "chest", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "shoulder_press_machine", Name: "Press Hombro en Maquina", MuscleGroup: "shoulders", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "lat_pulldown_neutral", Name: "Jalon Agarre Neutro", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "gironda_row", Name: "Remo Gironda", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: true},
	{ID: "machine_row", Name: "Remo en Maquina", MuscleGroup: "back", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "machine_preacher_curl", Name: "Curl Predicador en Maquina", MuscleGroup: "arms", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "machine_lat_pulldown", Name: "Jalon en Maquina", MuscleGroup: "back", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "t_bar_row", Name: "Remo en T", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "cable_upright_row", Name: "Remo al Menton en Polea", MuscleGroup: "shoulders", Equipment: strPtr("cable"), IsCompound: true},
	{ID: "incline_leg_press", Name: "Prensa Inclinada", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "hack_squat", Name: "Hack Squat", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "horizontal_leg_press", Name: "Prensa Horizontal", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},

	// PHUL
	{ID: "skullcrusher", Name: "Extensión de Tríceps Tumbado", MuscleGroup: "arms", Equipment: strPtr("barbell"), IsCompound: false},
	{ID: "incline_bench", Name: "Press Inclinado con Barra", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "front_squat", Name: "Sentadilla Frontal", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},

	// Mutenroshi — Core
	{ID: "plank", Name: "Plancha", MuscleGroup: "core", Equipment: strPtr("bodyweight"), IsCompound: false},
	{ID: "reverse_plank", Name: "Plancha Inversa", MuscleGroup: "core", Equipment: strPtr("bodyweight"), IsCompound: false},
	{ID: "sit_up_decline", Name: "Abdominal en Banco Declinado", MuscleGroup: "core", Equipment: strPtr("bodyweight"), IsCompound: false},

	// Mutenroshi — Squat/DL Activation
	{ID: "leg_curl_prone", Name: "Curl Femoral Tumbado", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "hyperextension", Name: "Hiperextension", MuscleGroup: "back", Equipment: strPtr("bodyweight"), IsCompound: false},

	// Mutenroshi — Bench Activation
	{ID: "lateral_raise_band", Name: "Elevacion Lateral con Banda", MuscleGroup: "shoulders", Equipment: strPtr("bands"), IsCompound: false},
	{ID: "french_press_bench", Name: "Press Frances en Banco", MuscleGroup: "arms", Equipment: strPtr("barbell"), IsCompound: false},
	{ID: "rear_delt_band", Name: "Deltoides Posterior con Banda", MuscleGroup: "shoulders", Equipment: strPtr("bands"), IsCompound: false},

	// Mutenroshi — Squat Proprioception
	{ID: "bulgarian_split_squat_slow", Name: "Zancada Bulgara Lenta", MuscleGroup: "legs", Equipment: strPtr("bodyweight"), IsCompound: true}, //nolint:misspell // Spanish
	{ID: "calf_raise_proprioceptive", Name: "Elevacion de Gemelo Propioceptiva", MuscleGroup: "calves", Equipment: strPtr("bodyweight"), IsCompound: false},

	// Mutenroshi — Bench Proprioception
	{ID: "pulley_band_seated", Name: "Polea con Banda Sentado", MuscleGroup: "back", Equipment: strPtr("bands"), IsCompound: true},
	{ID: "pushup_isometric", Name: "Flexion Isometrica", MuscleGroup: "chest", Equipment: strPtr("bodyweight"), IsCompound: true},

	// Mutenroshi — DL Proprioception
	{ID: "deadlift_partial_blocks", Name: "Peso Muerto Parcial desde Bloques", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "leg_press_isometric", Name: "Prensa Isometrica", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},

	// Mutenroshi — Fundamentals (bodyweight)
	{ID: "squat_bodyweight", Name: "Sentadilla sin Peso", MuscleGroup: "legs", Equipment: strPtr("bodyweight"), IsCompound: true},
	{ID: "bench_pushups", Name: "Flexiones", MuscleGroup: "chest", Equipment: strPtr("bodyweight"), IsCompound: true},
	{ID: "deadlift_isometric", Name: "Peso Muerto Isometrico", MuscleGroup: "back", Equipment: strPtr("bodyweight"), IsCompound: true},

	// Mutenroshi — Fundamentals (loaded)
	{ID: "squat_barbell", Name: "Sentadilla con Barra", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench_press_barbell", Name: "Press Banca con Barra", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift_barbell", Name: "Peso Muerto con Barra", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},

	// Brunetti 365
	{ID: "bench_board", Name: "Press Banca con Tabla", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench_pin", Name: "Press Banca con Pin", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "one_arm_row", Name: "Remo Unilateral", MuscleGroup: "back", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "deadlift_elevated", Name: "Peso Muerto desde Elevacion", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "seal_row", Name: "Seal Row", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "leg_press_unilateral", Name: "Prensa Unilateral", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "curl_elastico", Name: "Curl con Elastico", MuscleGroup: "arms", Equipment: strPtr("bands"), IsCompound: false},
	{ID: "french_press_band", Name: "Press Frances con Elastico", MuscleGroup: "arms", Equipment: strPtr("bands"), IsCompound: false},
	{ID: "lateral_raise_seated", Name: "Elevaciones Laterales Sentado", MuscleGroup: "shoulders", Equipment: strPtr("dumbbell"), IsCompound: false},
	{ID: "pin_squat", Name: "Sentadilla desde Pin", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},

	// Sheiko — Squat Variations
	{ID: "paused-squat-2s", Name: "Sentadilla con pausa 2s", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "squat-pause-halfway-down", Name: "Sentadilla pausa a media bajada", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "squat-pause-halfway-up", Name: "Sentadilla pausa a media subida", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "squat-chains", Name: "Sentadilla con cadenas", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},

	// Sheiko — Bench Press Variations
	{ID: "paused-bench-2s", Name: "Press banca con pausa 2s", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "paused-bench-3s", Name: "Press banca con pausa 3s", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench-bands", Name: "Press banca con bandas", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench-chains", Name: "Press banca con cadenas", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench-slingshot", Name: "Press banca con slingshot", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "board-press", Name: "Press en tabla", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "decline-bench", Name: "Press banca declinado", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "speed-bench", Name: "Press banca velocidad", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "dumbbell-bench", Name: "Press banca con mancuernas", MuscleGroup: "chest", Equipment: strPtr("dumbbell"), IsCompound: true},
	{ID: "incline-shoulder-press", Name: "Press hombro inclinado sentado", MuscleGroup: "shoulders", Equipment: strPtr("barbell"), IsCompound: true},

	// Sheiko — Deadlift Variations
	{ID: "deadlift-bands", Name: "Peso muerto con bandas", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-chains", Name: "Peso muerto con cadenas", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-blocks", Name: "Peso muerto desde bloques", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-blocks-chains", Name: "Peso muerto bloques + cadenas", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deficit-deadlift", Name: "Peso muerto deficit", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-pause-knees", Name: "Peso muerto pausa rodillas", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-knees-full", Name: "Peso muerto rodillas + completo", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-plus-below-knees", Name: "Peso muerto + desde debajo rodillas", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-above-knees-blocks", Name: "Peso muerto encima rodillas bloques", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-pause-below-above", Name: "Peso muerto pausa debajo y encima", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "deadlift-snatch-grip", Name: "Peso muerto agarre arrancada", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},

	// Sheiko — GPP / Accessories
	{ID: "pecs", Name: "Pectorales", MuscleGroup: "chest", Equipment: nil, IsCompound: false},
	{ID: "front-delts", Name: "Deltoides frontales", MuscleGroup: "shoulders", Equipment: nil, IsCompound: false},
	{ID: "medial-delts", Name: "Deltoides laterales", MuscleGroup: "shoulders", Equipment: nil, IsCompound: false},
	{ID: "triceps-pushdowns", Name: "Extension triceps polea", MuscleGroup: "arms", Equipment: strPtr("cable"), IsCompound: false},
	{ID: "triceps-standing", Name: "Triceps de pie", MuscleGroup: "arms", Equipment: nil, IsCompound: false},
	{ID: "lats", Name: "Dorsales", MuscleGroup: "back", Equipment: nil, IsCompound: false},
	{ID: "abs", Name: "Abdominales", MuscleGroup: "core", Equipment: nil, IsCompound: false},
	{ID: "hyperextensions", Name: "Hiperextensiones", MuscleGroup: "back", Equipment: strPtr("bodyweight"), IsCompound: false},
	{ID: "reverse-hyperextensions", Name: "Hiperextensiones inversas", MuscleGroup: "back", Equipment: strPtr("bodyweight"), IsCompound: false},
	{ID: "leg-curls", Name: "Curl femoral", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "leg-extensions", Name: "Extension cuadriceps", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: false},
	{ID: "leg-press", Name: "Prensa de piernas", MuscleGroup: "legs", Equipment: strPtr("machine"), IsCompound: true},
	{ID: "goodmorning", Name: "Buenos dias", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "goodmorning-seated", Name: "Buenos dias sentado", MuscleGroup: "back", Equipment: strPtr("barbell"), IsCompound: true},

	// Sheiko — Additional GPP (7.4 / 7.5)
	{ID: "dips", Name: "Fondos en paralelas", MuscleGroup: "chest", Equipment: strPtr("bodyweight"), IsCompound: true},
	{ID: "seated-rowing", Name: "Remo sentado", MuscleGroup: "back", Equipment: strPtr("cable"), IsCompound: true},
	{ID: "bench-close-grip", Name: "Press Banca agarre cerrado", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "bench-middle-grip", Name: "Press Banca agarre medio", MuscleGroup: "chest", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "front-squat", Name: "Sentadilla frontal", MuscleGroup: "legs", Equipment: strPtr("barbell"), IsCompound: true},
	{ID: "rear-delts", Name: "Deltoides posteriores", MuscleGroup: "shoulders", Equipment: nil, IsCompound: false},
	{ID: "biceps", Name: "Biceps", MuscleGroup: "arms", Equipment: nil, IsCompound: false},
	{ID: "french-press", Name: "Press Frances", MuscleGroup: "arms", Equipment: strPtr("barbell"), IsCompound: false},
}

func seedExercises(ctx context.Context, pool *pgxpool.Pool) error {
	const batchSize = 50
	for i := 0; i < len(canonicalExercises); i += batchSize {
		end := i + batchSize
		if end > len(canonicalExercises) {
			end = len(canonicalExercises)
		}
		batch := canonicalExercises[i:end]

		var b strings.Builder
		b.WriteString(`INSERT INTO exercises (id, name, muscle_group_id, equipment, is_compound, is_preset, created_by) VALUES `)
		args := make([]any, 0, len(batch)*5)
		for j, ex := range batch {
			if j > 0 {
				b.WriteString(", ")
			}
			base := j*5 + 1
			fmt.Fprintf(&b, "($%d, $%d, $%d, $%d, $%d, true, NULL)", base, base+1, base+2, base+3, base+4)
			args = append(args, ex.ID, ex.Name, ex.MuscleGroup, ex.Equipment, ex.IsCompound)
		}
		b.WriteString(" ON CONFLICT DO NOTHING")

		if _, err := pool.Exec(ctx, b.String(), args...); err != nil {
			return fmt.Errorf("insert exercises batch %d: %w", i/batchSize, err)
		}
	}
	return nil
}
