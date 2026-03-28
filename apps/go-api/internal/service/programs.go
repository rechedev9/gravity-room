package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/engine"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

// CreateInstance creates a new catalog-backed program instance.
func CreateInstance(ctx context.Context, pool *pgxpool.Pool, userID, programID, name string, config any) (*model.ProgramInstanceResponse, error) {
	if err := validateCatalogProgram(ctx, pool, programID); err != nil {
		return nil, err
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("marshal config: %w", err)
	}

	// Auto-complete existing active instances for this user.
	_, _ = pool.Exec(ctx, `
		UPDATE program_instances
		SET status = 'completed', updated_at = NOW()
		WHERE user_id = $1 AND status = 'active'
	`, userID)

	var id string
	var createdAt, updatedAt time.Time

	err = pool.QueryRow(ctx, `
		INSERT INTO program_instances (user_id, program_id, definition_id, custom_definition, name, config, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'active')
		RETURNING id, created_at, updated_at
	`, userID, programID, nil, nil, name, configJSON).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert instance: %w", err)
	}

	resp := &model.ProgramInstanceResponse{
		ID:               id,
		ProgramID:        programID,
		Name:             name,
		Config:           config,
		Metadata:         nil,
		Status:           "active",
		Results:          map[string]any{},
		UndoHistory:      []map[string]any{},
		ResultTimestamps: map[string]string{},
		CompletedDates:   map[string]string{},
		DefinitionID:     nil,
		CustomDefinition: nil,
		CreatedAt:        model.FormatTime(createdAt),
		UpdatedAt:        model.FormatTime(updatedAt),
	}
	return resp, nil
}

// CreateCustomInstance creates a new user-owned custom program instance.
func CreateCustomInstance(ctx context.Context, pool *pgxpool.Pool, userID, definitionID, name string, config any) (*model.ProgramInstanceResponse, error) {
	programID, hydratedJSON, customDefinition, err := loadOwnedCustomDefinition(ctx, pool, userID, definitionID)
	if err != nil {
		return nil, err
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("marshal config: %w", err)
	}

	_, _ = pool.Exec(ctx, `
		UPDATE program_instances
		SET status = 'completed', updated_at = NOW()
		WHERE user_id = $1 AND status = 'active'
	`, userID)

	var id string
	var createdAt, updatedAt time.Time
	defID := &definitionID
	err = pool.QueryRow(ctx, `
		INSERT INTO program_instances (user_id, program_id, definition_id, custom_definition, name, config, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'active')
		RETURNING id, created_at, updated_at
	`, userID, programID, defID, hydratedJSON, name, configJSON).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		return nil, apierror.New(500, "Failed to create program instance", apierror.CodeCreateFailed)
	}

	return &model.ProgramInstanceResponse{
		ID:               id,
		ProgramID:        programID,
		Name:             name,
		Config:           config,
		Metadata:         nil,
		Status:           "active",
		Results:          map[string]any{},
		UndoHistory:      []map[string]any{},
		ResultTimestamps: map[string]string{},
		CompletedDates:   map[string]string{},
		DefinitionID:     defID,
		CustomDefinition: customDefinition,
		CreatedAt:        model.FormatTime(createdAt),
		UpdatedAt:        model.FormatTime(updatedAt),
	}, nil
}

// ListInstances returns paginated program instances for a user.
func ListInstances(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) (*model.ProgramListResponse, error) {
	var rows pgx.Rows
	var err error

	if cursor != "" {
		// Parse cursor: ISO_UUID format.
		idx := strings.LastIndex(cursor, "_")
		if idx < 0 {
			return nil, fmt.Errorf("invalid cursor")
		}
		cursorTime := cursor[:idx]
		cursorID := cursor[idx+1:]

		ts, parseErr := time.Parse("2006-01-02T15:04:05.000Z", cursorTime)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid cursor")
		}

		rows, err = pool.Query(ctx, `
			SELECT id, program_id, name, status, created_at, updated_at
			FROM program_instances
			WHERE user_id = $1
			  AND (created_at < $2 OR (created_at = $2 AND id > $3))
			ORDER BY created_at DESC, id ASC
			LIMIT $4
		`, userID, ts, cursorID, limit+1)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT id, program_id, name, status, created_at, updated_at
			FROM program_instances
			WHERE user_id = $1
			ORDER BY created_at DESC, id ASC
			LIMIT $2
		`, userID, limit+1)
	}

	if err != nil {
		return nil, fmt.Errorf("list instances: %w", err)
	}
	defer rows.Close()

	items := make([]model.ProgramInstanceListItem, 0)
	for rows.Next() {
		var item model.ProgramInstanceListItem
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.ProgramID, &item.Name, &item.Status, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan instance list item: %w", err)
		}
		item.CreatedAt = model.FormatTime(createdAt)
		item.UpdatedAt = model.FormatTime(updatedAt)
		items = append(items, item)
	}

	var nextCursor *string
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		c := last.CreatedAt + "_" + last.ID
		nextCursor = &c
	}

	return &model.ProgramListResponse{
		Data:       items,
		NextCursor: nextCursor,
	}, nil
}

// GetInstance fetches a single program instance with results and undo history.
func GetInstance(ctx context.Context, pool *pgxpool.Pool, userID, id string) (*model.ProgramInstanceResponse, error) {
	// Fetch instance.
	var resp model.ProgramInstanceResponse
	var createdAt, updatedAt time.Time
	var configJSON, metadataJSON, customDefJSON []byte

	err := pool.QueryRow(ctx, `
		SELECT id, program_id, definition_id, name, config, metadata, custom_definition, status, created_at, updated_at
		FROM program_instances
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&resp.ID, &resp.ProgramID, &resp.DefinitionID, &resp.Name,
		&configJSON, &metadataJSON, &customDefJSON,
		&resp.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierror.New(404, "Program instance not found", apierror.CodeInstanceNotFound)
		}
		return nil, fmt.Errorf("instance not found")
	}

	resp.CreatedAt = model.FormatTime(createdAt)
	resp.UpdatedAt = model.FormatTime(updatedAt)

	// Unmarshal JSONB fields.
	if configJSON != nil {
		_ = json.Unmarshal(configJSON, &resp.Config)
	}
	if metadataJSON != nil {
		_ = json.Unmarshal(metadataJSON, &resp.Metadata)
	}
	if customDefJSON != nil {
		_ = json.Unmarshal(customDefJSON, &resp.CustomDefinition)
	}

	// Build results map, resultTimestamps, and completedDates.
	resp.Results, resp.ResultTimestamps, resp.CompletedDates, err = buildResults(ctx, pool, id)
	if err != nil {
		return nil, err
	}

	// Build undo history.
	resp.UndoHistory, err = buildUndoHistory(ctx, pool, id)
	if err != nil {
		return nil, err
	}

	return &resp, nil
}

// buildResults reconstructs the nested results map, resultTimestamps, and completedDates.
func buildResults(ctx context.Context, pool *pgxpool.Pool, instanceID string) (map[string]any, map[string]string, map[string]string, error) {
	rows, err := pool.Query(ctx, `
		SELECT workout_index, slot_id, result, amrap_reps, rpe, set_logs, completed_at, created_at
		FROM workout_results
		WHERE instance_id = $1
		ORDER BY workout_index, slot_id
	`, instanceID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("fetch results: %w", err)
	}
	defer rows.Close()

	results := map[string]any{}
	timestamps := map[string]string{}
	completedDates := map[string]string{}

	for rows.Next() {
		var workoutIndex int
		var slotID, result string
		var amrapReps, rpe *int
		var setLogsJSON []byte
		var completedAt *time.Time
		var createdAt time.Time

		if err := rows.Scan(&workoutIndex, &slotID, &result, &amrapReps, &rpe, &setLogsJSON, &completedAt, &createdAt); err != nil {
			return nil, nil, nil, fmt.Errorf("scan result row: %w", err)
		}

		wiKey := fmt.Sprintf("%d", workoutIndex)

		// Build result entry — optional fields omitted when nil.
		entry := map[string]any{"result": result}
		if amrapReps != nil {
			entry["amrapReps"] = *amrapReps
		}
		if rpe != nil {
			entry["rpe"] = *rpe
		}
		if setLogsJSON != nil {
			var setLogs any
			if err := json.Unmarshal(setLogsJSON, &setLogs); err == nil {
				entry["setLogs"] = setLogs
			}
		}

		// Nest into results[workoutIndex][slotId].
		if _, ok := results[wiKey]; !ok {
			results[wiKey] = map[string]any{}
		}
		results[wiKey].(map[string]any)[slotID] = entry

		// Track earliest createdAt per workout.
		ts := model.FormatTime(createdAt)
		if existing, ok := timestamps[wiKey]; !ok || ts < existing {
			timestamps[wiKey] = ts
		}

		// Track completedAt.
		if completedAt != nil {
			cDate := model.FormatTime(*completedAt)
			if existing, ok := completedDates[wiKey]; !ok || cDate < existing {
				completedDates[wiKey] = cDate
			}
		}
	}

	return results, timestamps, completedDates, nil
}

// buildUndoHistory fetches undo entries ordered by ID ascending (insertion order).
func buildUndoHistory(ctx context.Context, pool *pgxpool.Pool, instanceID string) ([]map[string]any, error) {
	rows, err := pool.Query(ctx, `
		SELECT workout_index, slot_id, prev_result, prev_amrap_reps, prev_rpe, prev_set_logs
		FROM undo_entries
		WHERE instance_id = $1
		ORDER BY id ASC
	`, instanceID)
	if err != nil {
		return nil, fmt.Errorf("fetch undo entries: %w", err)
	}
	defer rows.Close()

	history := make([]map[string]any, 0)
	for rows.Next() {
		var workoutIndex int
		var slotID string
		var prevResult *string
		var prevAmrapReps, prevRpe *int
		var prevSetLogsJSON []byte

		if err := rows.Scan(&workoutIndex, &slotID, &prevResult, &prevAmrapReps, &prevRpe, &prevSetLogsJSON); err != nil {
			return nil, fmt.Errorf("scan undo entry: %w", err)
		}

		entry := map[string]any{
			"i":      workoutIndex,
			"slotId": slotID,
		}
		if prevResult != nil {
			entry["prev"] = *prevResult
		}
		if prevAmrapReps != nil {
			entry["prevAmrapReps"] = *prevAmrapReps
		}
		if prevRpe != nil {
			entry["prevRpe"] = *prevRpe
		}
		if prevSetLogsJSON != nil {
			var setLogs any
			if err := json.Unmarshal(prevSetLogsJSON, &setLogs); err == nil {
				entry["prevSetLogs"] = setLogs
			}
		}

		history = append(history, entry)
	}

	return history, nil
}

// UpdateInstance partially updates a program instance (name, status, config).
// Ownership checked via WHERE — no separate SELECT.
func UpdateInstance(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, name *string, status *string, config any) (*model.ProgramInstanceResponse, error) {
	// Build dynamic SET clause — only include provided fields.
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1

	if name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *name)
		argIdx++
	}
	if status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *status)
		argIdx++
	}
	if config != nil {
		configJSON, err := json.Marshal(config)
		if err != nil {
			return nil, fmt.Errorf("marshal config: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, configJSON)
		argIdx++
	}

	// WHERE clause params.
	args = append(args, instanceID, userID)

	query := fmt.Sprintf(`
		UPDATE program_instances
		SET %s
		WHERE id = $%d AND user_id = $%d
		RETURNING id, program_id, definition_id, name, config, metadata, custom_definition, status, created_at, updated_at
	`, strings.Join(setClauses, ", "), argIdx, argIdx+1)

	var resp model.ProgramInstanceResponse
	var createdAt, updatedAt time.Time
	var configJSON, metadataJSON, customDefJSON []byte

	err := pool.QueryRow(ctx, query, args...).Scan(
		&resp.ID, &resp.ProgramID, &resp.DefinitionID, &resp.Name,
		&configJSON, &metadataJSON, &customDefJSON,
		&resp.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierror.New(404, "Program instance not found", apierror.CodeInstanceNotFound)
		}
		return nil, fmt.Errorf("instance not found")
	}

	resp.CreatedAt = model.FormatTime(createdAt)
	resp.UpdatedAt = model.FormatTime(updatedAt)

	if configJSON != nil {
		_ = json.Unmarshal(configJSON, &resp.Config)
	}
	if metadataJSON != nil {
		_ = json.Unmarshal(metadataJSON, &resp.Metadata)
	}
	if customDefJSON != nil {
		_ = json.Unmarshal(customDefJSON, &resp.CustomDefinition)
	}

	// Fetch results and undo history for the full response.
	var buildErr error
	resp.Results, resp.ResultTimestamps, resp.CompletedDates, buildErr = buildResults(ctx, pool, instanceID)
	if buildErr != nil {
		return nil, buildErr
	}

	resp.UndoHistory, buildErr = buildUndoHistory(ctx, pool, instanceID)
	if buildErr != nil {
		return nil, buildErr
	}

	return &resp, nil
}

const maxMetadataBytes = 10_000

// UpdateInstanceMetadata shallow-merges metadata using PostgreSQL JSONB || operator.
func UpdateInstanceMetadata(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, metadata json.RawMessage) (*model.ProgramInstanceResponse, error) {
	if len(metadata) > maxMetadataBytes {
		return nil, apierror.New(400, "Metadata exceeds 10KB limit", apierror.CodeMetadataTooLarge)
	}

	var resp model.ProgramInstanceResponse
	var createdAt, updatedAt time.Time
	var configJSON, metadataJSON, customDefJSON []byte

	err := pool.QueryRow(ctx, `
		UPDATE program_instances
		SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
		    updated_at = NOW()
		WHERE id = $2 AND user_id = $3
		RETURNING id, program_id, definition_id, name, config, metadata, custom_definition, status, created_at, updated_at
	`, metadata, instanceID, userID).Scan(
		&resp.ID, &resp.ProgramID, &resp.DefinitionID, &resp.Name,
		&configJSON, &metadataJSON, &customDefJSON,
		&resp.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierror.New(404, "Program instance not found", apierror.CodeInstanceNotFound)
		}
		return nil, fmt.Errorf("instance not found")
	}

	resp.CreatedAt = model.FormatTime(createdAt)
	resp.UpdatedAt = model.FormatTime(updatedAt)

	if configJSON != nil {
		_ = json.Unmarshal(configJSON, &resp.Config)
	}
	if metadataJSON != nil {
		_ = json.Unmarshal(metadataJSON, &resp.Metadata)
	}
	if customDefJSON != nil {
		_ = json.Unmarshal(customDefJSON, &resp.CustomDefinition)
	}

	var buildErr error
	resp.Results, resp.ResultTimestamps, resp.CompletedDates, buildErr = buildResults(ctx, pool, instanceID)
	if buildErr != nil {
		return nil, buildErr
	}
	resp.UndoHistory, buildErr = buildUndoHistory(ctx, pool, instanceID)
	if buildErr != nil {
		return nil, buildErr
	}

	return &resp, nil
}

// ExportInstance returns a portable JSON snapshot of a program instance.
func ExportInstance(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string) (map[string]any, error) {
	resp, err := GetInstance(ctx, pool, userID, instanceID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"version":     1,
		"exportDate":  time.Now().UTC().Format(time.RFC3339Nano),
		"programId":   resp.ProgramID,
		"name":        resp.Name,
		"config":      resp.Config,
		"results":     resp.Results,
		"undoHistory": resp.UndoHistory,
	}, nil
}

// ImportInstance creates a new program instance from an exported JSON snapshot,
// bulk-inserting results and undo history within a single transaction.
func ImportInstance(ctx context.Context, pool *pgxpool.Pool, userID string, data map[string]any) (*model.ProgramInstanceResponse, error) {
	programID, _ := data["programId"].(string)
	name, _ := data["name"].(string)
	if programID == "" || name == "" {
		return nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	if len(name) > 100 {
		return nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	if err := validateImportEnvelope(data); err != nil {
		return nil, err
	}
	definition, err := loadCatalogDefinition(ctx, pool, programID)
	if err != nil {
		return nil, err
	}
	configMap, err := validateImportConfig(data["config"])
	if err != nil {
		return nil, err
	}
	results, undoHistory, err := validateImportedData(data, definition)
	if err != nil {
		return nil, err
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("marshal config: %w", err)
	}

	tx, txErr := pool.Begin(ctx)
	if txErr != nil {
		return nil, fmt.Errorf("begin tx: %w", txErr)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Insert the program instance.
	var instanceID string
	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO program_instances (user_id, program_id, name, config, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id, created_at, updated_at
	`, userID, programID, name, configJSON).Scan(&instanceID, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert instance: %w", err)
	}

	// Bulk insert results.
	for wiStr, slotsRaw := range results {
		slots, ok := slotsRaw.(map[string]any)
		if !ok {
			continue
		}
		workoutIndex, convErr := strconv.Atoi(wiStr)
		if convErr != nil {
			return nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		for slotID, slotRaw := range slots {
			slot, ok := slotRaw.(map[string]any)
			if !ok {
				continue
			}
			result, _ := slot["result"].(string)
			if result == "" {
				continue
			}
			var amrapReps, rpe *int
			if v, ok := slot["amrapReps"].(float64); ok {
				iv := int(v)
				amrapReps = &iv
			}
			if v, ok := slot["rpe"].(float64); ok {
				iv := int(v)
				rpe = &iv
			}
			var setLogsJSON []byte
			if sl, ok := slot["setLogs"]; ok && sl != nil {
				setLogsJSON, _ = json.Marshal(sl)
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO workout_results (instance_id, workout_index, slot_id, result, amrap_reps, rpe, set_logs)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, instanceID, workoutIndex, slotID, result, amrapReps, rpe, setLogsJSON)
			if err != nil {
				return nil, apierror.New(500, "Failed to import program", apierror.CodeImportFailed)
			}
		}
	}

	// Bulk insert undo history.
	for _, entryRaw := range undoHistory {
		entry, ok := entryRaw.(map[string]any)
		if !ok {
			continue
		}
		workoutIndex, _ := entry["i"].(float64)
		slotID, _ := entry["slotId"].(string)
		if slotID == "" {
			continue
		}
		var prevResult *string
		if v, ok := entry["prev"].(string); ok {
			prevResult = &v
		}
		var prevAmrapReps, prevRpe *int
		if v, ok := entry["prevAmrapReps"].(float64); ok {
			iv := int(v)
			prevAmrapReps = &iv
		}
		if v, ok := entry["prevRpe"].(float64); ok {
			iv := int(v)
			prevRpe = &iv
		}
		var prevSetLogsJSON []byte
		if sl, ok := entry["prevSetLogs"]; ok && sl != nil {
			prevSetLogsJSON, _ = json.Marshal(sl)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO undo_entries (instance_id, workout_index, slot_id, prev_result, prev_amrap_reps, prev_rpe, prev_set_logs)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, instanceID, int(workoutIndex), slotID, prevResult, prevAmrapReps, prevRpe, prevSetLogsJSON)
		if err != nil {
			return nil, apierror.New(500, "Failed to import program", apierror.CodeImportFailed)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, apierror.New(500, "Failed to import program", apierror.CodeImportFailed)
	}

	// Fetch the full response after commit.
	return GetInstance(ctx, pool, userID, instanceID)
}

// DeleteInstance deletes a program instance (ownership checked via WHERE).
func DeleteInstance(ctx context.Context, pool *pgxpool.Pool, userID, id string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM program_instances
		WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return fmt.Errorf("delete instance: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierror.New(404, "Program instance not found", apierror.CodeInstanceNotFound)
	}
	return nil
}

func validateCatalogProgram(ctx context.Context, pool *pgxpool.Pool, programID string) error {
	var id string
	err := pool.QueryRow(ctx, `
		SELECT id
		FROM program_templates
		WHERE id = $1 AND is_active = true
	`, programID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierror.New(400, fmt.Sprintf("Unknown program: %s", programID), apierror.CodeInvalidProgram)
		}
		return fmt.Errorf("validate catalog program: %w", err)
	}
	return nil
}

func loadCatalogDefinition(ctx context.Context, pool *pgxpool.Pool, programID string) (engine.ProgramDefinition, error) {
	var rawDefinition []byte
	err := pool.QueryRow(ctx, `
		SELECT definition
		FROM program_templates
		WHERE id = $1 AND is_active = true
	`, programID).Scan(&rawDefinition)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return engine.ProgramDefinition{}, apierror.New(400, fmt.Sprintf("Unknown program: %s", programID), apierror.CodeInvalidProgram)
		}
		return engine.ProgramDefinition{}, fmt.Errorf("load catalog definition: %w", err)
	}

	hydratedJSON, err := hydrateDefinitionJSON(ctx, pool, rawDefinition)
	if err != nil {
		return engine.ProgramDefinition{}, apierror.New(500, "Program definition hydration failed", apierror.CodeHydrationFailed)
	}

	var definition engine.ProgramDefinition
	if err := json.Unmarshal(hydratedJSON, &definition); err != nil {
		return engine.ProgramDefinition{}, apierror.New(500, "Program definition hydration failed", apierror.CodeHydrationFailed)
	}

	return definition, nil
}

func loadOwnedCustomDefinition(ctx context.Context, pool *pgxpool.Pool, userID, definitionID string) (string, []byte, any, error) {
	var ownerID string
	var rawDefinition []byte
	err := pool.QueryRow(ctx, `
		SELECT user_id, definition
		FROM program_definitions
		WHERE id = $1 AND deleted_at IS NULL
	`, definitionID).Scan(&ownerID, &rawDefinition)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, nil, apierror.New(404, "Definition not found", apierror.CodeNotFound)
		}
		return "", nil, nil, fmt.Errorf("load custom definition: %w", err)
	}
	if ownerID != userID {
		return "", nil, nil, apierror.New(403, "Forbidden", apierror.CodeForbidden)
	}

	hydratedJSON, err := hydrateDefinitionJSON(ctx, pool, rawDefinition)
	if err != nil {
		return "", nil, nil, apierror.New(422, "Definition invalid", apierror.CodeDefinitionInvalid)
	}
	var definition engine.ProgramDefinition
	if err := json.Unmarshal(hydratedJSON, &definition); err != nil {
		return "", nil, nil, apierror.New(422, "Definition invalid", apierror.CodeDefinitionInvalid)
	}
	if err := validateProgramDefinition(definition); err != nil {
		return "", nil, nil, apierror.New(422, err.Error(), apierror.CodeDefinitionInvalid)
	}

	var customDefinition any
	if err := json.Unmarshal(hydratedJSON, &customDefinition); err != nil {
		return "", nil, nil, apierror.New(422, "Definition invalid", apierror.CodeDefinitionInvalid)
	}

	return "custom:" + definitionID, hydratedJSON, customDefinition, nil
}

func validateProgramDefinition(def engine.ProgramDefinition) error {
	if len(def.Days) == 0 {
		return fmt.Errorf("definition must have at least one day")
	}
	for _, day := range def.Days {
		if len(day.Slots) == 0 {
			return fmt.Errorf("definition must have at least one slot per day")
		}
		for _, slot := range day.Slots {
			if slot.ID == "" || slot.ExerciseID == "" || len(slot.Stages) == 0 {
				return fmt.Errorf("definition contains invalid slot")
			}
		}
	}
	return nil
}

func validateImportEnvelope(data map[string]any) error {
	version, ok := data["version"].(float64)
	if !ok || version != 1 {
		return apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	if exportDate, ok := data["exportDate"].(string); !ok || exportDate == "" {
		return apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	undoHistory, ok := data["undoHistory"].([]any)
	if !ok {
		return apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	if len(undoHistory) > 500 {
		return apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	return nil
}

func validateImportConfig(raw any) (map[string]any, error) {
	config, ok := raw.(map[string]any)
	if !ok {
		return nil, apierror.New(400, "Invalid config format", apierror.CodeInvalidData)
	}
	for key, value := range config {
		if len(key) == 0 || len(key) > 30 {
			return nil, apierror.New(400, "Invalid config format", apierror.CodeInvalidData)
		}
		switch v := value.(type) {
		case float64:
			if v < 0 || v > 10000 || math.IsNaN(v) {
				return nil, apierror.New(400, "Invalid config format", apierror.CodeInvalidData)
			}
		case string:
			if len(v) > 100 {
				return nil, apierror.New(400, "Invalid config format", apierror.CodeInvalidData)
			}
		default:
			return nil, apierror.New(400, "Invalid config format", apierror.CodeInvalidData)
		}
	}
	return config, nil
}

func validateImportedData(data map[string]any, definition engine.ProgramDefinition) (map[string]any, []any, error) {
	results, ok := data["results"].(map[string]any)
	if !ok {
		return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}
	undoHistory, ok := data["undoHistory"].([]any)
	if !ok {
		return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
	}

	validSlotIDs := make(map[string]struct{})
	for _, day := range definition.Days {
		for _, slot := range day.Slots {
			validSlotIDs[slot.ID] = struct{}{}
		}
	}

	for indexStr, slotsRaw := range results {
		idx, err := strconv.Atoi(indexStr)
		if err != nil || idx < 0 || idx >= definition.TotalWorkouts {
			return nil, nil, apierror.New(400, fmt.Sprintf("Invalid workoutIndex: %s", indexStr), apierror.CodeInvalidData)
		}
		slots, ok := slotsRaw.(map[string]any)
		if !ok {
			return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		for slotID, slotRaw := range slots {
			if _, ok := validSlotIDs[slotID]; !ok {
				return nil, nil, apierror.New(400, fmt.Sprintf("Unknown slotId: %s", slotID), apierror.CodeInvalidData)
			}
			slot, ok := slotRaw.(map[string]any)
			if !ok {
				return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
			}
			if result, ok := slot["result"]; ok {
				resultString, ok := result.(string)
				if !ok || (resultString != "success" && resultString != "fail") {
					return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
				}
			}
			if amrap, ok := slot["amrapReps"].(float64); ok {
				if amrap < 0 || amrap > 99 || amrap != math.Trunc(amrap) {
					return nil, nil, apierror.New(400, "amrapReps cannot exceed 99", apierror.CodeInvalidData)
				}
			}
			if rpe, ok := slot["rpe"].(float64); ok {
				if rpe < 6 || rpe > 10 || rpe != math.Trunc(rpe) {
					return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
				}
			}
		}
	}

	for _, entryRaw := range undoHistory {
		entry, ok := entryRaw.(map[string]any)
		if !ok {
			return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		i, ok := entry["i"].(float64)
		if !ok || i < 0 || i != math.Trunc(i) {
			return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		slotID, ok := entry["slotId"].(string)
		if !ok || slotID == "" {
			return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		if _, ok := validSlotIDs[slotID]; !ok {
			return nil, nil, apierror.New(400, fmt.Sprintf("Unknown slotId: %s", slotID), apierror.CodeInvalidData)
		}
		if prev, ok := entry["prev"].(string); ok && prev != "success" && prev != "fail" {
			return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
		}
		if prevRPE, ok := entry["prevRpe"].(float64); ok {
			if prevRPE < 1 || prevRPE > 10 || prevRPE != math.Trunc(prevRPE) {
				return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
			}
		}
		if prevAmrap, ok := entry["prevAmrapReps"].(float64); ok {
			if prevAmrap < 0 || prevAmrap != math.Trunc(prevAmrap) {
				return nil, nil, apierror.New(400, "Invalid import data", apierror.CodeInvalidData)
			}
		}
	}

	return results, undoHistory, nil
}
