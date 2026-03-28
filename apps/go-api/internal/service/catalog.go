package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/engine"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

func loadExerciseRows(ctx context.Context, pool *pgxpool.Pool) ([]engine.ExerciseRow, error) {
	rows, err := pool.Query(ctx, `SELECT id, name FROM exercises`)
	if err != nil {
		return nil, fmt.Errorf("load exercises: %w", err)
	}
	defer rows.Close()

	exercises := make([]engine.ExerciseRow, 0)
	for rows.Next() {
		var row engine.ExerciseRow
		if err := rows.Scan(&row.ID, &row.Name); err != nil {
			return nil, fmt.Errorf("scan exercise: %w", err)
		}
		exercises = append(exercises, row)
	}

	return exercises, nil
}

func hydrateDefinitionJSON(ctx context.Context, pool *pgxpool.Pool, defJSON []byte) ([]byte, error) {
	exerciseRows, err := loadExerciseRows(ctx, pool)
	if err != nil {
		return nil, err
	}

	hydrated, err := engine.HydrateProgramDefinition(defJSON, exerciseRows)
	if err != nil {
		return nil, fmt.Errorf("hydrate definition: %w", err)
	}

	patched, err := json.Marshal(hydrated)
	if err != nil {
		return nil, fmt.Errorf("marshal hydrated definition: %w", err)
	}

	return patched, nil
}

// ListCatalog returns all active program templates with metadata.
func ListCatalog(ctx context.Context, pool *pgxpool.Pool) ([]model.CatalogEntry, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			id, name, description, author, category, level, source,
			(definition->>'totalWorkouts')::int,
			(definition->>'workoutsPerWeek')::int,
			(definition->>'cycleLength')::int
		FROM program_templates
		WHERE is_active = true
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list catalog: %w", err)
	}
	defer rows.Close()

	entries := make([]model.CatalogEntry, 0)
	for rows.Next() {
		var e model.CatalogEntry
		if err := rows.Scan(
			&e.ID, &e.Name, &e.Description, &e.Author,
			&e.Category, &e.Level, &e.Source,
			&e.TotalWorkouts, &e.WorkoutsPerWeek, &e.CycleLength,
		); err != nil {
			return nil, fmt.Errorf("scan catalog entry: %w", err)
		}
		entries = append(entries, e)
	}

	return entries, nil
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

type rateLimitEntry struct {
	mu          sync.Mutex
	count       int
	windowStart time.Time
}

var previewRateLimits sync.Map

const previewRateLimit = 30
const previewWindowDur = time.Hour

// CheckPreviewRateLimit returns true if the request is allowed, false if rate limited.
func CheckPreviewRateLimit(userID string) bool {
	actual, _ := previewRateLimits.LoadOrStore(userID, &rateLimitEntry{windowStart: time.Now()})
	entry := actual.(*rateLimitEntry)
	entry.mu.Lock()
	defer entry.mu.Unlock()
	if time.Since(entry.windowStart) > previewWindowDur {
		entry.count = 0
		entry.windowStart = time.Now()
	}
	entry.count++
	return entry.count <= previewRateLimit
}

// ResolvePreviewConfig resolves the raw config against program configFields.
func ResolvePreviewConfig(def engine.ProgramDefinition, rawConfig map[string]any) map[string]any {
	resolved := make(map[string]any)
	for _, field := range def.ConfigFields {
		switch field.Type {
		case "weight":
			if v, ok := rawConfig[field.Key]; ok {
				switch val := v.(type) {
				case float64:
					resolved[field.Key] = val
				case string:
					resolved[field.Key] = val
				default:
					resolved[field.Key] = 0.0
				}
			} else {
				resolved[field.Key] = 0.0
			}
		case "select":
			if v, ok := rawConfig[field.Key]; ok {
				if s, ok := v.(string); ok {
					resolved[field.Key] = s
					continue
				}
			}
			if len(field.Options) > 0 {
				resolved[field.Key] = field.Options[0].Value
			}
		}
	}
	return resolved
}

var validRuleTypes = map[string]bool{
	"add_weight":               true,
	"advance_stage":            true,
	"advance_stage_add_weight": true,
	"deload_percent":           true,
	"add_weight_reset_stage":   true,
	"no_change":                true,
	"update_tm":                true,
	"double_progression":       true,
}

func validatePreviewDefinition(def engine.ProgramDefinition) error {
	if len(def.Days) == 0 {
		return fmt.Errorf("definition must have at least one day")
	}
	for _, day := range def.Days {
		if len(day.Slots) == 0 {
			return fmt.Errorf("day %q must have at least one slot", day.Name)
		}
		for _, slot := range day.Slots {
			if len(slot.Stages) == 0 {
				return fmt.Errorf("slot %q must have at least one stage", slot.ID)
			}
			// GPP and prescription slots don't require progression rules
			if slot.IsGpp || len(slot.Prescriptions) > 0 {
				continue
			}
			// Required rules must be present for standard slots
			if slot.OnSuccess == nil {
				return fmt.Errorf("slot %q missing required field onSuccess", slot.ID)
			}
			if slot.OnMidStageFail == nil {
				return fmt.Errorf("slot %q missing required field onMidStageFail", slot.ID)
			}
			if slot.OnFinalStageFail == nil {
				return fmt.Errorf("slot %q missing required field onFinalStageFail", slot.ID)
			}
			// Validate all rule types (including optional ones)
			allRules := []*engine.ProgressionRule{
				slot.OnSuccess, slot.OnMidStageFail, slot.OnFinalStageFail,
				slot.OnUndefined, slot.OnFinalStageSuccess,
			}
			for _, rule := range allRules {
				if rule != nil && !validRuleTypes[rule.Type] {
					return fmt.Errorf("unknown rule type %q in slot %q", rule.Type, slot.ID)
				}
			}
		}
	}
	return nil
}

// PreviewDefinition validates and computes the first 10 workout rows for a definition.
func PreviewDefinition(def engine.ProgramDefinition, rawConfig map[string]any) ([]engine.GenericWorkoutRow, error) {
	if err := validatePreviewDefinition(def); err != nil {
		return nil, err
	}
	resolved := ResolvePreviewConfig(def, rawConfig)
	rows := engine.ComputeGenericProgram(def, resolved, nil)
	max := 10
	if len(rows) < max {
		max = len(rows)
	}
	return rows[:max], nil
}

// GetCatalogDefinition returns the raw JSONB definition for a program template.
func GetCatalogDefinition(ctx context.Context, pool *pgxpool.Pool, programID string) (any, error) {
	var defJSON []byte
	err := pool.QueryRow(ctx, `
		SELECT definition
		FROM program_templates
		WHERE id = $1 AND is_active = true
	`, programID).Scan(&defJSON)
	if err != nil {
		return nil, fmt.Errorf("catalog definition not found")
	}

	hydratedJSON, err := hydrateDefinitionJSON(ctx, pool, defJSON)
	if err != nil {
		return nil, err
	}

	var def any
	if err := json.Unmarshal(hydratedJSON, &def); err != nil {
		return nil, fmt.Errorf("unmarshal definition: %w", err)
	}
	return def, nil
}
