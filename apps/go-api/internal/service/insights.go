package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

// GetInsights returns pre-computed insights for the given user, optionally
// filtered by a comma-separated list of insight types.
func GetInsights(ctx context.Context, pool *pgxpool.Pool, userID string, types []string) ([]model.InsightResponse, error) {
	query := `
		SELECT insight_type, exercise_id, payload, computed_at, valid_until
		FROM user_insights
		WHERE user_id = $1
	`
	args := []any{userID}

	if len(types) > 0 {
		placeholders := make([]string, len(types))
		for i, t := range types {
			placeholders[i] = fmt.Sprintf("$%d", i+2)
			args = append(args, t)
		}
		query += " AND insight_type = ANY(ARRAY[" + strings.Join(placeholders, ",") + "])"
	}

	query += " ORDER BY insight_type, exercise_id NULLS FIRST"

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query insights: %w", err)
	}
	defer rows.Close()

	var insights []model.InsightResponse
	for rows.Next() {
		var (
			insightType string
			exerciseID  *string
			payload     json.RawMessage
			computedAt  time.Time
			validUntil  *time.Time
		)
		if err := rows.Scan(&insightType, &exerciseID, &payload, &computedAt, &validUntil); err != nil {
			return nil, fmt.Errorf("scan insight row: %w", err)
		}

		item := model.InsightResponse{
			InsightType: insightType,
			ExerciseID:  exerciseID,
			Payload:     payload,
			ComputedAt:  model.FormatTime(computedAt),
		}
		if validUntil != nil {
			s := model.FormatTime(*validUntil)
			item.ValidUntil = &s
		}
		insights = append(insights, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate insight rows: %w", err)
	}

	if insights == nil {
		insights = []model.InsightResponse{}
	}
	return insights, nil
}
