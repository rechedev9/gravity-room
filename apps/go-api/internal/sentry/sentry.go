package sentry

import (
	"log/slog"
	"time"

	sentrysdk "github.com/getsentry/sentry-go"
)

var enabled bool

// Init initialises Sentry from the DSN. No-op when dsn is empty.
// Must be called once, early in main(), before any goroutines that might panic.
func Init(dsn, environment string, log *slog.Logger) {
	if dsn == "" {
		log.Info("sentry disabled (no SENTRY_DSN)")
		return
	}
	err := sentrysdk.Init(sentrysdk.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		TracesSampleRate: 0, // matches TS: performance tracing disabled
	})
	if err != nil {
		log.Error("sentry init failed", "err", err)
		return
	}
	enabled = true
	log.Info("sentry initialized", "environment", environment)
}

// CaptureException reports an error to Sentry. No-op when disabled.
func CaptureException(err error) {
	if !enabled {
		return
	}
	sentrysdk.CaptureException(err)
}

// Flush drains buffered events. Call during graceful shutdown.
func Flush(timeout time.Duration) {
	if !enabled {
		return
	}
	sentrysdk.Flush(timeout)
}
