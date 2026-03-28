package sentry

import (
	"errors"
	"testing"
	"time"
)

func TestCaptureExceptionNoop(t *testing.T) {
	// CaptureException must not panic when Init has not been called.
	CaptureException(errors.New("test error"))
}

func TestFlushNoop(t *testing.T) {
	// Flush must not panic when Init has not been called.
	Flush(time.Second)
}
