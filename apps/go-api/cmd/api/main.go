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
	"github.com/reche/gravity-room/apps/go-api/internal/migrate"
	"github.com/reche/gravity-room/apps/go-api/internal/redis"
	"github.com/reche/gravity-room/apps/go-api/internal/seed"
	goSentry "github.com/reche/gravity-room/apps/go-api/internal/sentry"
	"github.com/reche/gravity-room/apps/go-api/internal/server"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
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

	// Initialise Sentry — must be before anything that might panic.
	goSentry.Init(cfg.SentryDSN, cfg.Env, log)

	// Connect to PostgreSQL.
	pool, err := db.New(context.Background(), cfg.DatabaseURL, cfg.DBPoolSize)
	if err != nil {
		log.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	log.Info("database connected")

	// Run database migrations (DDL, serial, single-connection).
	log.Info("running database migrations")
	if err := migrate.Run(context.Background(), cfg.DatabaseURL); err != nil {
		log.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}
	log.Info("database migrations complete")

	// Run reference data seeds (idempotent, safe to run on every startup).
	log.Info("running reference data seeds")
	if err := seed.Run(context.Background(), pool); err != nil {
		log.Error("failed to run seeds", "err", err)
		os.Exit(1)
	}
	log.Info("reference data seeds complete")

	// Connect to Redis (optional — graceful fallback to in-memory).
	redisClient := redis.New(cfg.RedisURL, log)

	srv := server.New(cfg, log, pool, redisClient)

	// Background token cleanup (matches TS bootstrap.ts TOKEN_CLEANUP_INTERVAL_MS = 6h).
	cleanupCtx, cleanupCancel := context.WithCancel(context.Background())
	defer cleanupCancel()
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-cleanupCtx.Done():
				return
			case <-ticker.C:
				n, err := service.CleanExpiredTokens(cleanupCtx, pool)
				if err != nil {
					log.Error("token cleanup failed", "err", err)
				} else if n > 0 {
					log.Info("cleaned expired tokens", "count", n)
				}
			}
		}
	}()

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

		if err := redisClient.Close(); err != nil {
			log.Error("error disconnecting redis", "err", err)
		}

		goSentry.Flush(2 * time.Second)

		log.Info("shutdown complete")
	}
}
