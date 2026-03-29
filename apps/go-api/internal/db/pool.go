package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// HealthResult holds the outcome of a database health probe.
type HealthResult struct {
	Status    string `json:"status"`
	LatencyMs int    `json:"latencyMs"`
}

// New creates a pgxpool connection pool from the given database URL.
func New(ctx context.Context, databaseURL string, maxConns int) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}
	cfg.MaxConns = int32(maxConns)

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	// Verify connectivity.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

// Probe runs SELECT 1 and returns a HealthResult with latency.
// If pool is nil, returns a stub ok result (used in tests without a real DB).
func Probe(ctx context.Context, pool *pgxpool.Pool) HealthResult {
	if pool == nil {
		return HealthResult{Status: "ok", LatencyMs: 0}
	}
	start := time.Now()
	var n int
	err := pool.QueryRow(ctx, "SELECT 1").Scan(&n)
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		return HealthResult{Status: "error", LatencyMs: latency}
	}
	return HealthResult{Status: "ok", LatencyMs: latency}
}
