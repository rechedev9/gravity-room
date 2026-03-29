package seed

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type muscleGroup struct {
	ID   string
	Name string
}

var muscleGroups = []muscleGroup{
	{ID: "chest", Name: "Pecho"},
	{ID: "back", Name: "Espalda"},
	{ID: "shoulders", Name: "Hombros"},
	{ID: "legs", Name: "Piernas"},
	{ID: "arms", Name: "Brazos"},
	{ID: "core", Name: "Core"},
	{ID: "full_body", Name: "Cuerpo Completo"},
	{ID: "calves", Name: "Gemelos"},
}

func seedMuscleGroups(ctx context.Context, pool *pgxpool.Pool) error {
	for _, mg := range muscleGroups {
		if _, err := pool.Exec(ctx,
			`INSERT INTO muscle_groups (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			mg.ID, mg.Name,
		); err != nil {
			return fmt.Errorf("insert muscle group %s: %w", mg.ID, err)
		}
	}
	return nil
}
