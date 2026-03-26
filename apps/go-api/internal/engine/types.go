package engine

// ResultValue represents the outcome of a workout slot.
type ResultValue = string

// SetLogEntry records per-set reps/weight for double progression.
type SetLogEntry struct {
	Reps   int      `json:"reps"`
	Weight *float64 `json:"weight,omitempty"`
	Rpe    *float64 `json:"rpe,omitempty"`
}

// ResolvedPrescription is a computed prescription with resolved weight.
// All fields required — no omitempty.
type ResolvedPrescription struct {
	Percent float64 `json:"percent"`
	Sets    int     `json:"sets"`
	Reps    int     `json:"reps"`
	Weight  float64 `json:"weight"`
}

// PrescriptionEntry is a raw prescription entry from the definition.
type PrescriptionEntry struct {
	Percent float64 `json:"percent"`
	Sets    int     `json:"sets"`
	Reps    int     `json:"reps"`
}

// StageDefinition describes one stage of an exercise slot.
type StageDefinition struct {
	Sets   int  `json:"sets"`
	Reps   int  `json:"reps"`
	Amrap  bool `json:"amrap,omitempty"`
	RepsMax *int `json:"repsMax,omitempty"`
}

// ProgressionRule is a flat discriminated union keyed by Type.
type ProgressionRule struct {
	Type           string   `json:"type"`
	Percent        *float64 `json:"percent,omitempty"`        // deload_percent
	Amount         *float64 `json:"amount,omitempty"`          // add_weight_reset_stage / update_tm
	MinAmrapReps   *int     `json:"minAmrapReps,omitempty"`    // update_tm
	RepRangeTop    *int     `json:"repRangeTop,omitempty"`     // double_progression
	RepRangeBottom *int     `json:"repRangeBottom,omitempty"`  // double_progression
}

// ExerciseSlot is a single slot within a workout day.
type ExerciseSlot struct {
	ID                    string              `json:"id"`
	ExerciseID            string              `json:"exerciseId"`
	ExerciseName          string              `json:"exerciseName,omitempty"` // injected by hydration
	Tier                  string              `json:"tier"`
	Stages                []StageDefinition   `json:"stages"`
	OnSuccess             *ProgressionRule    `json:"onSuccess"`
	OnFinalStageSuccess   *ProgressionRule    `json:"onFinalStageSuccess,omitempty"`
	OnUndefined           *ProgressionRule    `json:"onUndefined,omitempty"`
	OnMidStageFail        *ProgressionRule    `json:"onMidStageFail"`
	OnFinalStageFail      *ProgressionRule    `json:"onFinalStageFail"`
	StartWeightKey        string              `json:"startWeightKey"`
	StartWeightMultiplier *float64            `json:"startWeightMultiplier,omitempty"`
	StartWeightOffset     *int                `json:"startWeightOffset,omitempty"`
	TrainingMaxKey        string              `json:"trainingMaxKey,omitempty"`
	TmPercent             *float64            `json:"tmPercent,omitempty"`
	Role                  *string             `json:"role,omitempty"`
	Notes                 *string             `json:"notes,omitempty"`
	Prescriptions         []PrescriptionEntry `json:"prescriptions,omitempty"`
	PercentOf             string              `json:"percentOf,omitempty"`
	IsGpp                 bool                `json:"isGpp,omitempty"`
	IsBodyweight          bool                `json:"isBodyweight,omitempty"`
	ComplexReps           *string             `json:"complexReps,omitempty"`
	PropagatesTo          *string             `json:"propagatesTo,omitempty"`
	IsTestSlot            bool                `json:"isTestSlot,omitempty"`
	ProgressionSetIndex   *int                `json:"progressionSetIndex,omitempty"`
}

// WorkoutDay is one day within the program cycle.
type WorkoutDay struct {
	Name  string         `json:"name"`
	Slots []ExerciseSlot `json:"slots"`
}

// ExerciseEntry is a catalog entry for a single exercise.
type ExerciseEntry struct {
	Name string `json:"name"`
}

// ConfigOption is one option in a select config field.
type ConfigOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ConfigField describes one user-configurable program parameter.
type ConfigField struct {
	Key       string         `json:"key"`
	Label     string         `json:"label"`
	Type      string         `json:"type"` // "weight" or "select"
	Min       *float64       `json:"min,omitempty"`
	Step      *float64       `json:"step,omitempty"`
	Group     *string        `json:"group,omitempty"`
	Hint      *string        `json:"hint,omitempty"`
	GroupHint *string        `json:"groupHint,omitempty"`
	Options   []ConfigOption `json:"options,omitempty"`
}

// ProgramDefinition is the full program DSL.
type ProgramDefinition struct {
	ID                    string                   `json:"id"`
	Name                  string                   `json:"name"`
	Description           string                   `json:"description"`
	Author                string                   `json:"author"`
	Version               int                      `json:"version"`
	Category              string                   `json:"category"`
	Source                string                   `json:"source"`
	Days                  []WorkoutDay             `json:"days"`
	CycleLength           int                      `json:"cycleLength"`
	TotalWorkouts         int                      `json:"totalWorkouts"`
	WorkoutsPerWeek       int                      `json:"workoutsPerWeek"`
	Exercises             map[string]ExerciseEntry `json:"exercises"`
	ConfigFields          []ConfigField            `json:"configFields"`
	WeightIncrements      map[string]float64       `json:"weightIncrements"`
	ConfigTitle           *string                  `json:"configTitle,omitempty"`
	ConfigDescription     *string                  `json:"configDescription,omitempty"`
	ConfigEditTitle       *string                  `json:"configEditTitle,omitempty"`
	ConfigEditDescription *string                  `json:"configEditDescription,omitempty"`
	DisplayMode           *string                  `json:"displayMode,omitempty"`
}

// ExerciseRow is a row from the exercises DB table.
type ExerciseRow struct {
	ID   string
	Name string
}

// SlotResult holds a recorded result for a single slot.
type SlotResult struct {
	Result    *string        `json:"result,omitempty"`
	AmrapReps *int           `json:"amrapReps,omitempty"`
	Rpe       *float64       `json:"rpe,omitempty"`
	SetLogs   []SetLogEntry  `json:"setLogs,omitempty"`
}

// GenericResults is results keyed by workout index string, then slot ID.
type GenericResults = map[string]map[string]SlotResult

// GenericSlotRow is one computed slot row.
// Required fields have no omitempty; optional fields use pointer+omitempty.
type GenericSlotRow struct {
	SlotID       string                 `json:"slotId"`
	ExerciseID   string                 `json:"exerciseId"`
	ExerciseName string                 `json:"exerciseName"`
	Tier         string                 `json:"tier"`
	Weight       float64                `json:"weight"`
	Stage        int                    `json:"stage"`
	Sets         int                    `json:"sets"`
	Reps         int                    `json:"reps"`
	IsAmrap      bool                   `json:"isAmrap"`
	StagesCount  int                    `json:"stagesCount"`
	IsChanged    bool                   `json:"isChanged"`
	IsDeload     bool                   `json:"isDeload"`
	Result       *string                `json:"result,omitempty"`
	AmrapReps    *int                   `json:"amrapReps,omitempty"`
	Rpe          *float64               `json:"rpe,omitempty"`
	RepsMax      *int                   `json:"repsMax,omitempty"`
	Role         *string                `json:"role,omitempty"`
	Notes        *string                `json:"notes,omitempty"`
	Prescriptions []ResolvedPrescription `json:"prescriptions,omitempty"`
	IsGpp        *bool                  `json:"isGpp,omitempty"`
	ComplexReps  *string                `json:"complexReps,omitempty"`
	PropagatesTo *string                `json:"propagatesTo,omitempty"`
	IsTestSlot   *bool                  `json:"isTestSlot,omitempty"`
	IsBodyweight *bool                  `json:"isBodyweight,omitempty"`
	SetLogs      []SetLogEntry          `json:"setLogs,omitempty"`
}

// GenericWorkoutRow is one computed workout row.
type GenericWorkoutRow struct {
	Index       int              `json:"index"`
	DayName     string           `json:"dayName"`
	Slots       []GenericSlotRow `json:"slots"`
	IsChanged   bool             `json:"isChanged"`
	CompletedAt *string          `json:"completedAt,omitempty"`
}

// ChartDataPoint is one data point for the exercise weight/stage chart.
// Result uses *string without omitempty so null is emitted when undefined.
type ChartDataPoint struct {
	Workout   int     `json:"workout"`
	Weight    float64 `json:"weight"`
	Stage     int     `json:"stage"`
	Result    *string `json:"result"`
	Date      *string `json:"date,omitempty"`
	AmrapReps *int    `json:"amrapReps,omitempty"`
}

// RpeDataPoint is one data point for RPE trend.
type RpeDataPoint struct {
	Workout int     `json:"workout"`
	Rpe     float64 `json:"rpe"`
	Date    *string `json:"date,omitempty"`
}

// AmrapDataPoint is one data point for AMRAP reps trend.
type AmrapDataPoint struct {
	Workout int     `json:"workout"`
	Reps    int     `json:"reps"`
	Weight  float64 `json:"weight"`
	Date    *string `json:"date,omitempty"`
}

// VolumeDataPoint is one data point for volume trend.
type VolumeDataPoint struct {
	Workout  int     `json:"workout"`
	VolumeKg float64 `json:"volumeKg"`
	Date     *string `json:"date,omitempty"`
}

// AllGenericStats aggregates all stats from a single pass over workout rows.
type AllGenericStats struct {
	ChartData  map[string][]ChartDataPoint  `json:"chartData"`
	RpeData    map[string][]RpeDataPoint    `json:"rpeData"`
	AmrapData  map[string][]AmrapDataPoint  `json:"amrapData"`
	VolumeData []VolumeDataPoint            `json:"volumeData"`
}

// GraduationTargets holds target weights for program graduation.
type GraduationTargets struct {
	Squat    float64 `json:"squat"`
	Bench    float64 `json:"bench"`
	Deadlift float64 `json:"deadlift"`
}
