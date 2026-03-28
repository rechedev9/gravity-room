package logging

import (
	"context"
	"log/slog"
	"testing"
)

func TestNewLogger_Levels(t *testing.T) {
	for _, tc := range []struct {
		input string
		want  slog.Level
	}{
		{"debug", slog.LevelDebug},
		{"info", slog.LevelInfo},
		{"warn", slog.LevelWarn},
		{"error", slog.LevelError},
		{"fatal", slog.LevelError},
		{"unknown", slog.LevelInfo},
	} {
		l := NewLogger(tc.input, true)
		if l.Handler().Enabled(context.Background(), tc.want) == false {
			t.Errorf("level %q: expected %v to be enabled", tc.input, tc.want)
		}
	}
}

func TestContextRoundtrip(t *testing.T) {
	l := NewTestLogger()
	ctx := WithContext(context.Background(), l)
	got := FromContext(ctx)
	if got != l {
		t.Error("FromContext did not return the stored logger")
	}
}

func TestFromContext_Fallback(t *testing.T) {
	got := FromContext(context.Background())
	if got == nil {
		t.Error("FromContext with empty ctx should return default, not nil")
	}
}

func TestRequestLogger(t *testing.T) {
	parent := NewTestLogger()
	child := RequestLogger(parent, "req-123", "GET", "/health", "127.0.0.1")
	if child == nil {
		t.Fatal("RequestLogger returned nil")
	}
}
