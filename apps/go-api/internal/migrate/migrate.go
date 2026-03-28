// Package migrate runs database schema migrations using goose with embedded SQL files.
package migrate

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib" // pgx as database/sql driver
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Run applies all pending migrations using a dedicated single-connection pool
// for serial DDL execution (matches the TS bootstrap contract §1).
func Run(ctx context.Context, databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open migration connection: %w", err)
	}
	defer func() { _ = db.Close() }()

	// Single connection for serial DDL execution.
	db.SetMaxOpenConns(1)

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping migration connection: %w", err)
	}

	// If this is an existing database (already migrated by Drizzle/TS),
	// seed the goose version table so goose skips all 33 migrations.
	if err := bootstrapExisting(ctx, db); err != nil {
		return fmt.Errorf("bootstrap existing database: %w", err)
	}

	goose.SetBaseFS(migrations)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	if err := goose.UpContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}

// bootstrapExisting detects databases already migrated by the TS API (Drizzle)
// and seeds goose's version table with all 33 migration versions marked as applied.
// This prevents goose from re-running DDL that already exists in the schema.
//
// Detection: if goose_db_version doesn't exist but the CHECK constraint from
// Drizzle migration 0031 exists, the schema was created by the TS API.
func bootstrapExisting(ctx context.Context, db *sql.DB) error {
	// Check if goose has already been initialized.
	var gooseExists bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'goose_db_version'
		)
	`).Scan(&gooseExists)
	if err != nil {
		return fmt.Errorf("check goose table: %w", err)
	}
	if gooseExists {
		return nil // Already bootstrapped or fresh goose run.
	}

	// Probe for migration 32's CHECK constraint (last migration applied by Drizzle).
	var schemaExists bool
	err = db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.table_constraints
			WHERE constraint_name = 'chk_workout_results_amrap_reps'
			  AND table_schema = 'public'
		)
	`).Scan(&schemaExists)
	if err != nil {
		return fmt.Errorf("probe schema: %w", err)
	}
	if !schemaExists {
		return nil // Fresh database — let goose run all migrations.
	}

	// Existing database: create goose version table and mark all 33 as applied.
	// (32 original Drizzle migrations + 1 hotfix from TS bootstrap.ts line 119)
	const maxVersion = 33

	if _, err := db.ExecContext(ctx, `
		CREATE TABLE goose_db_version (
			id         serial      NOT NULL,
			version_id bigint      NOT NULL,
			is_applied boolean     NOT NULL,
			tstamp     timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (id)
		)
	`); err != nil {
		return fmt.Errorf("create goose table: %w", err)
	}

	// Insert initial version 0 (goose convention).
	if _, err := db.ExecContext(ctx,
		`INSERT INTO goose_db_version (version_id, is_applied) VALUES (0, true)`,
	); err != nil {
		return fmt.Errorf("insert version 0: %w", err)
	}

	// Mark all 33 migrations as applied.
	for v := int64(1); v <= maxVersion; v++ {
		if _, err := db.ExecContext(ctx,
			`INSERT INTO goose_db_version (version_id, is_applied) VALUES ($1, true)`, v,
		); err != nil {
			return fmt.Errorf("insert version %d: %w", v, err)
		}
	}

	return nil
}
