package model

import (
	"time"
)

// FormatTime formats a time.Time as ISO 8601 with exactly 3 fractional digits.
// Matches the TS contract: "2006-01-02T15:04:05.000Z".
func FormatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// --------------------------------------------------------------------------
// Auth responses — matches harness schemas/auth.ts (Zod .strict())
// --------------------------------------------------------------------------

// UserResponse matches UserResponseSchema: {id, email, name, avatarUrl}.
// Nullable fields use *string so they serialize as null, not omitted.
type UserResponse struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatarUrl"`
}

// AuthResponse matches AuthResponseSchema: {user, accessToken}.
type AuthResponse struct {
	User        UserResponse `json:"user"`
	AccessToken string       `json:"accessToken"`
}

// RefreshResponse matches RefreshResponseSchema: {accessToken}.
type RefreshResponse struct {
	AccessToken string `json:"accessToken"`
}

// --------------------------------------------------------------------------
// Program responses — matches harness schemas/programs.ts
// --------------------------------------------------------------------------

// ProgramInstanceResponse matches ProgramInstanceResponseSchema.
// Fields with `any` use json.RawMessage or interface{} for JSONB passthrough.
type ProgramInstanceResponse struct {
	ID               string            `json:"id"`
	ProgramID        string            `json:"programId"`
	Name             string            `json:"name"`
	Config           any               `json:"config"`
	Metadata         any               `json:"metadata"`
	Status           string            `json:"status"`
	Results          map[string]any    `json:"results"`
	UndoHistory      []map[string]any  `json:"undoHistory"`
	ResultTimestamps map[string]string `json:"resultTimestamps"`
	CompletedDates   map[string]string `json:"completedDates"`
	DefinitionID     *string           `json:"definitionId"`
	CustomDefinition any               `json:"customDefinition"`
	CreatedAt        string            `json:"createdAt"`
	UpdatedAt        string            `json:"updatedAt"`
}

// ProgramInstanceListItem matches ProgramInstanceListItemSchema.
type ProgramInstanceListItem struct {
	ID        string `json:"id"`
	ProgramID string `json:"programId"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// ProgramListResponse matches ProgramListResponseSchema.
type ProgramListResponse struct {
	Data       []ProgramInstanceListItem `json:"data"`
	NextCursor *string                   `json:"nextCursor"`
}

// --------------------------------------------------------------------------
// Results responses — matches harness schemas/results.ts
// --------------------------------------------------------------------------

// UndoResponse matches UndoResponseSchema: {undone: UndoEntry | null}.
type UndoResponse struct {
	Undone any `json:"undone"`
}

// --------------------------------------------------------------------------
// Catalog responses — matches harness schemas/catalog.ts
// --------------------------------------------------------------------------

// CatalogEntry matches CatalogEntrySchema.
type CatalogEntry struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Author          string `json:"author"`
	Category        string `json:"category"`
	Level           string `json:"level"`
	Source          string `json:"source"`
	TotalWorkouts   int    `json:"totalWorkouts"`
	WorkoutsPerWeek int    `json:"workoutsPerWeek"`
	CycleLength     int    `json:"cycleLength"`
}

// --------------------------------------------------------------------------
// Exercise responses — matches harness schemas/exercises.ts
// --------------------------------------------------------------------------

// ExerciseEntry matches ExerciseEntrySchema.
// Nullable fields use *string/*bool so they serialize as null, not omitted.
type ExerciseEntry struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	MuscleGroupID    string   `json:"muscleGroupId"`
	Equipment        *string  `json:"equipment"`
	IsCompound       bool     `json:"isCompound"`
	IsPreset         bool     `json:"isPreset"`
	CreatedBy        *string  `json:"createdBy"`
	Force            *string  `json:"force"`
	Level            *string  `json:"level"`
	Mechanic         *string  `json:"mechanic"`
	Category         *string  `json:"category"`
	SecondaryMuscles []string `json:"secondaryMuscles"`
}

// ExerciseListResponse matches ExerciseListResponseSchema.
type ExerciseListResponse struct {
	Data   []ExerciseEntry `json:"data"`
	Total  int             `json:"total"`
	Offset int             `json:"offset"`
	Limit  int             `json:"limit"`
}

// MuscleGroupEntry matches the {id, name} shape in MuscleGroupsResponseSchema.
type MuscleGroupEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// --------------------------------------------------------------------------
// Program definition responses — matches harness schemas/program-definitions.ts
// --------------------------------------------------------------------------

// ProgramDefinitionResponse matches ProgramDefinitionResponseSchema.
type ProgramDefinitionResponse struct {
	ID         string  `json:"id"`
	UserID     string  `json:"userId"`
	Definition any     `json:"definition"`
	Status     string  `json:"status"`
	CreatedAt  string  `json:"createdAt"`
	UpdatedAt  string  `json:"updatedAt"`
	DeletedAt  *string `json:"deletedAt"`
}

// ProgramDefinitionListResponse matches ProgramDefinitionListResponseSchema.
type ProgramDefinitionListResponse struct {
	Data  []ProgramDefinitionResponse `json:"data"`
	Total int                         `json:"total"`
}

// --------------------------------------------------------------------------
// Stats responses — matches harness schemas/system.ts
// --------------------------------------------------------------------------

// StatsOnlineResponse matches StatsOnlineResponseSchema.
type StatsOnlineResponse struct {
	Count *int `json:"count"`
}

// --------------------------------------------------------------------------
// Error response — matches harness schemas/error.ts
// --------------------------------------------------------------------------

// ErrorResponse matches ErrorResponseSchema: {error, code}.
type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}
