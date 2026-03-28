// Package seed runs idempotent reference data inserts at startup.
package seed

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Run executes all seed functions in order. Each is idempotent (ON CONFLICT DO NOTHING/UPDATE).
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	if err := seedMuscleGroups(ctx, pool); err != nil {
		return fmt.Errorf("seed muscle groups: %w", err)
	}
	if err := seedExercises(ctx, pool); err != nil {
		return fmt.Errorf("seed exercises: %w", err)
	}
	if err := seedExercisesExpanded(ctx, pool); err != nil {
		return fmt.Errorf("seed expanded exercises: %w", err)
	}
	if err := seedProgramTemplates(ctx, pool); err != nil {
		return fmt.Errorf("seed program templates: %w", err)
	}
	return nil
}
