package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

// ExerciseFilters holds filter parameters for exercise listing.
type ExerciseFilters struct {
	Q             string
	MuscleGroupID string
	Equipment     string
	Force         string
	Level         string
	Mechanic      string
	Category      string
	IsCompound    string
}

var slugClean = regexp.MustCompile(`[^a-z0-9_]`)

// ListExercises returns paginated exercises with optional filters.
func ListExercises(ctx context.Context, pool *pgxpool.Pool, userID string, filters ExerciseFilters, offset, limit int) (*model.ExerciseListResponse, error) {
	// Build WHERE conditions.
	conditions := []string{}
	args := []any{}
	argN := 1

	// Visibility: preset or owned by user.
	if userID != "" {
		conditions = append(conditions, fmt.Sprintf("(is_preset = true OR created_by = $%d)", argN))
		args = append(args, userID)
		argN++
	} else {
		conditions = append(conditions, "is_preset = true")
	}

	// Text search.
	if filters.Q != "" {
		conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", argN))
		args = append(args, "%"+escapeLike(filters.Q)+"%")
		argN++
	}

	// Comma-separated filter fields.
	for _, f := range []struct {
		col string
		val string
	}{
		{"muscle_group_id", filters.MuscleGroupID},
		{"equipment", filters.Equipment},
		{"force", filters.Force},
		{"level", filters.Level},
		{"mechanic", filters.Mechanic},
		{"category", filters.Category},
	} {
		if f.val != "" {
			vals := splitCSV(f.val)
			if len(vals) > 0 {
				placeholders := make([]string, len(vals))
				for i, v := range vals {
					placeholders[i] = fmt.Sprintf("$%d", argN)
					args = append(args, v)
					argN++
				}
				conditions = append(conditions, fmt.Sprintf("%s IN (%s)", f.col, strings.Join(placeholders, ",")))
			}
		}
	}

	switch filters.IsCompound {
	case "true":
		conditions = append(conditions, "is_compound = true")
	case "false":
		conditions = append(conditions, "is_compound = false")
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count query.
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM exercises %s", where)
	if err := pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count exercises: %w", err)
	}

	// Data query.
	dataQuery := fmt.Sprintf(`
		SELECT id, name, muscle_group_id, equipment, is_compound, is_preset, created_by,
		       force, level, mechanic, category, secondary_muscles
		FROM exercises %s
		ORDER BY name ASC
		LIMIT $%d OFFSET $%d
	`, where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list exercises: %w", err)
	}
	defer rows.Close()

	data := make([]model.ExerciseEntry, 0)
	for rows.Next() {
		var e model.ExerciseEntry
		if err := rows.Scan(
			&e.ID, &e.Name, &e.MuscleGroupID, &e.Equipment,
			&e.IsCompound, &e.IsPreset, &e.CreatedBy,
			&e.Force, &e.Level, &e.Mechanic, &e.Category,
			&e.SecondaryMuscles,
		); err != nil {
			return nil, fmt.Errorf("scan exercise: %w", err)
		}
		data = append(data, e)
	}

	return &model.ExerciseListResponse{
		Data:   data,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	}, nil
}

// ListMuscleGroups returns all muscle groups.
func ListMuscleGroups(ctx context.Context, pool *pgxpool.Pool) ([]model.MuscleGroupEntry, error) {
	rows, err := pool.Query(ctx, `SELECT id, name FROM muscle_groups`)
	if err != nil {
		return nil, fmt.Errorf("list muscle groups: %w", err)
	}
	defer rows.Close()

	groups := make([]model.MuscleGroupEntry, 0)
	for rows.Next() {
		var g model.MuscleGroupEntry
		if err := rows.Scan(&g.ID, &g.Name); err != nil {
			return nil, fmt.Errorf("scan muscle group: %w", err)
		}
		groups = append(groups, g)
	}

	return groups, nil
}

// CreateExercise creates a custom exercise.
func CreateExercise(ctx context.Context, pool *pgxpool.Pool, userID, name, muscleGroupID, equipment string, isCompound bool) (*model.ExerciseEntry, error) {
	// Generate slug from name.
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "_")
	slug = slugClean.ReplaceAllString(slug, "")
	if len(slug) > 50 {
		slug = slug[:50]
	}
	if slug == "" {
		return nil, fmt.Errorf("invalid slug")
	}

	// Validate muscle group exists.
	var mgID string
	err := pool.QueryRow(ctx, `SELECT id FROM muscle_groups WHERE id = $1`, muscleGroupID).Scan(&mgID)
	if err != nil {
		return nil, fmt.Errorf("invalid muscle group")
	}

	// Insert exercise.
	var equip *string
	if equipment != "" {
		equip = &equipment
	}

	tag, err := pool.Exec(ctx, `
		INSERT INTO exercises (id, name, muscle_group_id, equipment, is_compound, is_preset, created_by)
		VALUES ($1, $2, $3, $4, $5, false, $6)
		ON CONFLICT DO NOTHING
	`, slug, name, muscleGroupID, equip, isCompound, userID)
	if err != nil {
		return nil, fmt.Errorf("insert exercise: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("duplicate")
	}

	// Fetch the inserted row.
	var entry model.ExerciseEntry
	err = pool.QueryRow(ctx, `
		SELECT id, name, muscle_group_id, equipment, is_compound, is_preset, created_by,
		       force, level, mechanic, category, secondary_muscles
		FROM exercises WHERE id = $1
	`, slug).Scan(
		&entry.ID, &entry.Name, &entry.MuscleGroupID, &entry.Equipment,
		&entry.IsCompound, &entry.IsPreset, &entry.CreatedBy,
		&entry.Force, &entry.Level, &entry.Mechanic, &entry.Category,
		&entry.SecondaryMuscles,
	)
	if err != nil {
		return nil, fmt.Errorf("fetch inserted exercise: %w", err)
	}

	return &entry, nil
}

func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) > 20 {
		result = result[:20]
	}
	return result
}
