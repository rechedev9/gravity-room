package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/config"
	"github.com/reche/gravity-room/apps/go-api/internal/db"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	"github.com/reche/gravity-room/apps/go-api/internal/server"
)

// shutdownTimeout matches the TS contract: 10 000 ms grace period.
const shutdownTimeout = 10 * time.Second

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	log := logging.NewLogger(cfg.LogLevel, cfg.IsProd())

	// Connect to PostgreSQL.
	pool, err := db.New(context.Background(), cfg.DatabaseURL, cfg.DBPoolSize)
	if err != nil {
		log.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	log.Info("database connected")

	srv := server.New(cfg, log, pool)

	// Graceful shutdown on SIGTERM / SIGINT (matches TS bootstrap.ts:209-210).
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	// Start server in background goroutine.
	errCh := make(chan error, 1)
	go func() { errCh <- srv.Start() }()

	select {
	case err := <-errCh:
		if err != nil {
			log.Error("server failed", "err", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		log.Info("signal received, draining connections")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error("error during shutdown", "err", err)
		}

		log.Info("shutdown complete")
	}
}
