package logging

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type ctxKey struct{}

// NewLogger creates the application-wide logger.
// Production: JSON to stdout. Dev/test: text to stdout.
// Matches TS contract: LOG_LEVEL env, redaction of auth/cookie (at middleware level).
func NewLogger(level string, isProd bool) *slog.Logger {
	lvl := parseLevel(level)
	opts := &slog.HandlerOptions{Level: lvl}

	var handler slog.Handler
	if isProd {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return slog.New(handler)
}

// NewTestLogger returns a logger that discards output.
func NewTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// WithContext stores the logger in the context.
func WithContext(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

// FromContext retrieves the logger from context, falling back to slog.Default.
func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

// RequestLogger creates a child logger for a single request.
// Mirrors TS requestLogger which creates pino.child({reqId, method, url, ip}).
func RequestLogger(parent *slog.Logger, reqID, method, url, ip string) *slog.Logger {
	return parent.With(
		slog.String("reqId", reqID),
		slog.String("method", method),
		slog.String("url", url),
		slog.String("ip", ip),
	)
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error", "fatal":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
