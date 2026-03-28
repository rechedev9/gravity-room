package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxUndoEntries = 50

// RecordResult records a workout result (upsert) and pushes an undo entry.
func RecordResult(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, workoutIndex int, slotID, result string, amrapReps, rpe *int, setLogs any) (map[string]any, error) {
	// Verify ownership.
	var ownerID string
	err := pool.QueryRow(ctx, `SELECT user_id FROM program_instances WHERE id = $1`, instanceID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		return nil, fmt.Errorf("instance not found")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Capture previous state for undo.
	var prevResult *string
	var prevAmrapReps, prevRpe *int
	var prevSetLogsJSON []byte

	prevErr := tx.QueryRow(ctx, `
		SELECT result, amrap_reps, rpe, set_logs
		FROM workout_results
		WHERE instance_id = $1 AND workout_index = $2 AND slot_id = $3
	`, instanceID, workoutIndex, slotID).Scan(&prevResult, &prevAmrapReps, &prevRpe, &prevSetLogsJSON)

	if prevErr != nil && prevErr != pgx.ErrNoRows {
		return nil, fmt.Errorf("fetch previous result: %w", prevErr)
	}

	// Marshal setLogs to JSONB.
	var setLogsJSON []byte
	if setLogs != nil {
		setLogsJSON, _ = json.Marshal(setLogs)
	}

	// Upsert result.
	_, err = tx.Exec(ctx, `
		INSERT INTO workout_results (instance_id, workout_index, slot_id, result, amrap_reps, rpe, set_logs)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (instance_id, workout_index, slot_id) DO UPDATE SET
			result = $4, amrap_reps = $5, rpe = $6, set_logs = $7, updated_at = NOW()
	`, instanceID, workoutIndex, slotID, result, amrapReps, rpe, setLogsJSON)
	if err != nil {
		return nil, fmt.Errorf("upsert result: %w", err)
	}

	// Push undo entry.
	var prevSetLogsForUndo []byte
	if prevErr == nil && prevSetLogsJSON != nil {
		prevSetLogsForUndo = prevSetLogsJSON
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO undo_entries (instance_id, workout_index, slot_id, prev_result, prev_amrap_reps, prev_rpe, prev_set_logs)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, instanceID, workoutIndex, slotID,
		nilIfNotFound(prevErr, prevResult),
		nilIfNotFoundInt(prevErr, prevAmrapReps),
		nilIfNotFoundInt(prevErr, prevRpe),
		nilIfNotFoundBytes(prevErr, prevSetLogsForUndo),
	)
	if err != nil {
		return nil, fmt.Errorf("push undo entry: %w", err)
	}

	// Trim undo stack.
	trimUndoStack(ctx, tx, instanceID)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// Touch instance timestamp outside transaction.
	_, _ = pool.Exec(ctx, `UPDATE program_instances SET updated_at = NOW() WHERE id = $1`, instanceID)

	// Build response entry — optional fields omitted when nil.
	entry := map[string]any{
		"workoutIndex": workoutIndex,
		"slotId":       slotID,
		"result":       result,
	}
	if amrapReps != nil {
		entry["amrapReps"] = *amrapReps
	}
	if rpe != nil {
		entry["rpe"] = *rpe
	}
	if setLogs != nil {
		entry["setLogs"] = setLogs
	}

	return entry, nil
}

// UndoLast pops the latest undo entry and restores the previous state.
func UndoLast(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string) (any, error) {
	// Verify ownership.
	var ownerID string
	err := pool.QueryRow(ctx, `SELECT user_id FROM program_instances WHERE id = $1`, instanceID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		return nil, fmt.Errorf("instance not found")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Pop most recent undo entry (highest ID = LIFO).
	var undoID int64
	var workoutIndex int
	var slotID string
	var prevResult *string
	var prevAmrapReps, prevRpe *int
	var prevSetLogsJSON []byte

	popErr := tx.QueryRow(ctx, `
		SELECT id, workout_index, slot_id, prev_result, prev_amrap_reps, prev_rpe, prev_set_logs
		FROM undo_entries
		WHERE instance_id = $1
		ORDER BY id DESC
		LIMIT 1
	`, instanceID).Scan(&undoID, &workoutIndex, &slotID, &prevResult, &prevAmrapReps, &prevRpe, &prevSetLogsJSON)

	if popErr == pgx.ErrNoRows {
		// Nothing to undo.
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit: %w", err)
		}
		return nil, nil
	}
	if popErr != nil {
		return nil, fmt.Errorf("pop undo entry: %w", popErr)
	}

	// Delete the consumed undo entry.
	_, _ = tx.Exec(ctx, `DELETE FROM undo_entries WHERE id = $1`, undoID)

	// Restore previous state.
	if prevResult == nil {
		// No previous result — delete the current result.
		_, _ = tx.Exec(ctx, `
			DELETE FROM workout_results
			WHERE instance_id = $1 AND workout_index = $2 AND slot_id = $3
		`, instanceID, workoutIndex, slotID)
	} else {
		// Restore previous result.
		_, _ = tx.Exec(ctx, `
			INSERT INTO workout_results (instance_id, workout_index, slot_id, result, amrap_reps, rpe, set_logs)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (instance_id, workout_index, slot_id) DO UPDATE SET
				result = $4, amrap_reps = $5, rpe = $6, set_logs = $7, updated_at = NOW()
		`, instanceID, workoutIndex, slotID, *prevResult, prevAmrapReps, prevRpe, prevSetLogsJSON)
	}

	// Trim undo stack.
	trimUndoStack(ctx, tx, instanceID)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// Touch instance timestamp outside transaction.
	_, _ = pool.Exec(ctx, `UPDATE program_instances SET updated_at = NOW() WHERE id = $1`, instanceID)

	// Build response — UndoEntryInnerSchema: {i, slotId, prev?, prevSetLogs?}
	// Note: NO prevRpe/prevAmrapReps in the undo response (different from undoHistory).
	entry := map[string]any{
		"i":      workoutIndex,
		"slotId": slotID,
	}
	if prevResult != nil {
		entry["prev"] = *prevResult
	}
	if prevSetLogsJSON != nil {
		var setLogs any
		if err := json.Unmarshal(prevSetLogsJSON, &setLogs); err == nil {
			entry["prevSetLogs"] = setLogs
		}
	}

	return entry, nil
}

// DeleteResult deletes a single workout result and pushes an undo entry.
func DeleteResult(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, workoutIndex int, slotID string) error {
	// Verify ownership.
	var ownerID string
	err := pool.QueryRow(ctx, `SELECT user_id FROM program_instances WHERE id = $1`, instanceID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		return fmt.Errorf("instance not found")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Fetch existing result.
	var resultID int64
	var prevResult string
	var prevAmrapReps, prevRpe *int
	var prevSetLogsJSON []byte

	fetchErr := tx.QueryRow(ctx, `
		SELECT id, result, amrap_reps, rpe, set_logs
		FROM workout_results
		WHERE instance_id = $1 AND workout_index = $2 AND slot_id = $3
	`, instanceID, workoutIndex, slotID).Scan(&resultID, &prevResult, &prevAmrapReps, &prevRpe, &prevSetLogsJSON)

	if fetchErr != nil {
		if fetchErr == pgx.ErrNoRows {
			return fmt.Errorf("result not found")
		}
		return fmt.Errorf("fetch result: %w", fetchErr)
	}

	// Push undo entry (captures current state before deletion).
	_, err = tx.Exec(ctx, `
		INSERT INTO undo_entries (instance_id, workout_index, slot_id, prev_result, prev_amrap_reps, prev_rpe, prev_set_logs)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, instanceID, workoutIndex, slotID, prevResult, prevAmrapReps, prevRpe, prevSetLogsJSON)
	if err != nil {
		return fmt.Errorf("push undo entry: %w", err)
	}

	// Delete the result.
	_, err = tx.Exec(ctx, `DELETE FROM workout_results WHERE id = $1`, resultID)
	if err != nil {
		return fmt.Errorf("delete result: %w", err)
	}

	// Trim undo stack.
	trimUndoStack(ctx, tx, instanceID)

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	// Touch instance timestamp outside transaction.
	_, _ = pool.Exec(ctx, `UPDATE program_instances SET updated_at = NOW() WHERE id = $1`, instanceID)

	return nil
}

// trimUndoStack removes oldest entries beyond maxUndoEntries.
func trimUndoStack(ctx context.Context, tx pgx.Tx, instanceID string) {
	var overflowID int64
	err := tx.QueryRow(ctx, `
		SELECT id FROM undo_entries
		WHERE instance_id = $1
		ORDER BY id DESC
		OFFSET $2
		LIMIT 1
	`, instanceID, maxUndoEntries).Scan(&overflowID)
	if err != nil {
		return // Fewer than max entries.
	}
	_, _ = tx.Exec(ctx, `DELETE FROM undo_entries WHERE instance_id = $1 AND id <= $2`, instanceID, overflowID)
}

func nilIfNotFound(err error, v *string) *string {
	if err == pgx.ErrNoRows {
		return nil
	}
	return v
}

func nilIfNotFoundInt(err error, v *int) *int {
	if err == pgx.ErrNoRows {
		return nil
	}
	return v
}

func nilIfNotFoundBytes(err error, v []byte) []byte {
	if err == pgx.ErrNoRows {
		return nil
	}
	return v
}
