package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

const maxDefinitionsPerUser = 10

// CreateDefinition creates a new custom program definition.
func CreateDefinition(ctx context.Context, pool *pgxpool.Pool, userID string, definition any) (*model.ProgramDefinitionResponse, error) {
	// Check limit.
	var count int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM program_definitions WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&count); err != nil {
		return nil, fmt.Errorf("count definitions: %w", err)
	}
	if count >= maxDefinitionsPerUser {
		return nil, fmt.Errorf("limit exceeded")
	}

	defJSON, err := json.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("marshal definition: %w", err)
	}

	var id string
	var createdAt, updatedAt time.Time

	err = pool.QueryRow(ctx, `
		INSERT INTO program_definitions (user_id, definition, status)
		VALUES ($1, $2, 'draft')
		RETURNING id, created_at, updated_at
	`, userID, defJSON).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert definition: %w", err)
	}

	return &model.ProgramDefinitionResponse{
		ID:         id,
		UserID:     userID,
		Definition: definition,
		Status:     "draft",
		CreatedAt:  model.FormatTime(createdAt),
		UpdatedAt:  model.FormatTime(updatedAt),
		DeletedAt:  nil,
	}, nil
}

// ListDefinitions returns paginated definitions for a user.
func ListDefinitions(ctx context.Context, pool *pgxpool.Pool, userID string, limit, offset int) (*model.ProgramDefinitionListResponse, error) {
	// Count.
	var total int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM program_definitions WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&total); err != nil {
		return nil, fmt.Errorf("count definitions: %w", err)
	}

	// Data.
	rows, err := pool.Query(ctx, `
		SELECT id, user_id, definition, status, created_at, updated_at, deleted_at
		FROM program_definitions
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list definitions: %w", err)
	}
	defer rows.Close()

	data := make([]model.ProgramDefinitionResponse, 0)
	for rows.Next() {
		d, err := scanDefinitionRow(rows)
		if err != nil {
			return nil, err
		}
		data = append(data, d)
	}

	return &model.ProgramDefinitionListResponse{
		Data:  data,
		Total: total,
	}, nil
}

// GetDefinition fetches a single definition owned by the user.
func GetDefinition(ctx context.Context, pool *pgxpool.Pool, userID, id string) (*model.ProgramDefinitionResponse, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, user_id, definition, status, created_at, updated_at, deleted_at
		FROM program_definitions
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID)

	d, err := scanDefinitionSingleRow(row)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}
	return &d, nil
}

// UpdateDefinition updates a program definition.
func UpdateDefinition(ctx context.Context, pool *pgxpool.Pool, userID, id string, definition any) (*model.ProgramDefinitionResponse, error) {
	defJSON, err := json.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("marshal definition: %w", err)
	}

	// Fetch current status for reset logic.
	var currentStatus string
	err = pool.QueryRow(ctx, `
		SELECT status FROM program_definitions
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID).Scan(&currentStatus)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	newStatus := currentStatus
	if currentStatus == "pending_review" || currentStatus == "approved" {
		newStatus = "draft"
	}

	var resp model.ProgramDefinitionResponse
	var createdAt, updatedAt time.Time
	var deletedAt *time.Time

	err = pool.QueryRow(ctx, `
		UPDATE program_definitions
		SET definition = $1, status = $2, updated_at = NOW()
		WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
		RETURNING id, user_id, definition, status, created_at, updated_at, deleted_at
	`, defJSON, newStatus, id, userID).Scan(
		&resp.ID, &resp.UserID, &defJSON, &resp.Status,
		&createdAt, &updatedAt, &deletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	_ = json.Unmarshal(defJSON, &resp.Definition)
	resp.CreatedAt = model.FormatTime(createdAt)
	resp.UpdatedAt = model.FormatTime(updatedAt)
	if deletedAt != nil {
		s := model.FormatTime(*deletedAt)
		resp.DeletedAt = &s
	}

	return &resp, nil
}

// DeleteDefinition soft-deletes a program definition.
func DeleteDefinition(ctx context.Context, pool *pgxpool.Pool, userID, id string) error {
	// Check for active instances.
	var activeCount int
	_ = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM program_instances
		WHERE definition_id = $1 AND status = 'active'
	`, id).Scan(&activeCount)
	if activeCount > 0 {
		return fmt.Errorf("active instances exist")
	}

	tag, err := pool.Exec(ctx, `
		UPDATE program_definitions
		SET deleted_at = NOW()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID)
	if err != nil {
		return fmt.Errorf("delete definition: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

// UpdateDefinitionStatus updates the status of a definition with state machine validation.
func UpdateDefinitionStatus(ctx context.Context, pool *pgxpool.Pool, userID, id, newStatus string, isAdmin bool) (*model.ProgramDefinitionResponse, error) {
	// Fetch current.
	var currentStatus, ownerID string
	err := pool.QueryRow(ctx, `
		SELECT status, user_id FROM program_definitions WHERE id = $1 AND deleted_at IS NULL
	`, id).Scan(&currentStatus, &ownerID)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	isOwner := ownerID == userID

	if !validateTransition(currentStatus, newStatus, isOwner, isAdmin) {
		return nil, fmt.Errorf("invalid transition")
	}

	var resp model.ProgramDefinitionResponse
	var defJSON []byte
	var createdAt, updatedAt time.Time
	var deletedAt *time.Time

	err = pool.QueryRow(ctx, `
		UPDATE program_definitions
		SET status = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, user_id, definition, status, created_at, updated_at, deleted_at
	`, newStatus, id).Scan(
		&resp.ID, &resp.UserID, &defJSON, &resp.Status,
		&createdAt, &updatedAt, &deletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update status: %w", err)
	}

	_ = json.Unmarshal(defJSON, &resp.Definition)
	resp.CreatedAt = model.FormatTime(createdAt)
	resp.UpdatedAt = model.FormatTime(updatedAt)
	if deletedAt != nil {
		s := model.FormatTime(*deletedAt)
		resp.DeletedAt = &s
	}

	return &resp, nil
}

// ForkDefinition creates a copy of an existing definition or template.
func ForkDefinition(ctx context.Context, pool *pgxpool.Pool, userID, sourceID, sourceType string) (*model.ProgramDefinitionResponse, error) {
	// Check limit.
	var count int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM program_definitions WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&count); err != nil {
		return nil, fmt.Errorf("count definitions: %w", err)
	}
	if count >= maxDefinitionsPerUser {
		return nil, fmt.Errorf("limit exceeded")
	}

	var defJSON []byte

	switch sourceType {
	case "template":
		err := pool.QueryRow(ctx, `
			SELECT definition FROM program_templates WHERE id = $1 AND is_active = true
		`, sourceID).Scan(&defJSON)
		if err != nil {
			return nil, fmt.Errorf("not found")
		}
	case "definition":
		var ownerID string
		err := pool.QueryRow(ctx, `
			SELECT definition, user_id FROM program_definitions
			WHERE id = $1 AND deleted_at IS NULL
		`, sourceID).Scan(&defJSON, &ownerID)
		if err != nil {
			return nil, fmt.Errorf("not found")
		}
		if ownerID != userID {
			return nil, fmt.Errorf("forbidden")
		}
	default:
		return nil, fmt.Errorf("invalid source type")
	}

	// Parse and modify the definition.
	var def map[string]any
	if err := json.Unmarshal(defJSON, &def); err != nil {
		return nil, fmt.Errorf("unmarshal source definition: %w", err)
	}

	// Append "(copia)" suffix to name.
	if name, ok := def["name"].(string); ok {
		def["name"] = name + " (copia)"
	}
	def["source"] = "custom"

	return CreateDefinition(ctx, pool, userID, def)
}

func validateTransition(from, to string, isOwner, isAdmin bool) bool {
	if from == "draft" && to == "pending_review" && isOwner {
		return true
	}
	if from == "pending_review" && to == "draft" && isOwner {
		return true
	}
	if from == "pending_review" && to == "approved" && isAdmin {
		return true
	}
	if from == "pending_review" && to == "rejected" && isAdmin {
		return true
	}
	return false
}

type scannable interface {
	Scan(dest ...any) error
}

func scanDefinitionRow(rows scannable) (model.ProgramDefinitionResponse, error) {
	var d model.ProgramDefinitionResponse
	var defJSON []byte
	var createdAt, updatedAt time.Time
	var deletedAt *time.Time

	if err := rows.Scan(&d.ID, &d.UserID, &defJSON, &d.Status, &createdAt, &updatedAt, &deletedAt); err != nil {
		return d, fmt.Errorf("scan definition: %w", err)
	}

	_ = json.Unmarshal(defJSON, &d.Definition)
	d.CreatedAt = model.FormatTime(createdAt)
	d.UpdatedAt = model.FormatTime(updatedAt)
	if deletedAt != nil {
		s := model.FormatTime(*deletedAt)
		d.DeletedAt = &s
	}
	return d, nil
}

func scanDefinitionSingleRow(row scannable) (model.ProgramDefinitionResponse, error) {
	return scanDefinitionRow(row)
}
