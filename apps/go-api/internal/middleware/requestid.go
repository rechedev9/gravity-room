package middleware

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

type ctxKey int

const (
	keyReqID ctxKey = iota
	keyIP
	keyStartMs
)

// reqIDRe matches the TS regex /^[\w-]{8,64}$/ for client-supplied request IDs.
var reqIDRe = regexp.MustCompile(`^[\w-]{8,64}$`)

// RequestID is a chi middleware that assigns a request ID, extracts the client IP,
// logs "incoming request" on entry and "request completed" on exit.
// Matches TS request-logger.ts contract exactly.
func RequestID(trustedProxy bool, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Request ID: use client header if valid, otherwise generate.
			reqID := r.Header.Get("x-request-id")
			if !reqIDRe.MatchString(reqID) {
				reqID = newUUID()
			}

			// IP extraction matching TS contract (request-logger.ts:25-27).
			ip := extractIP(r, trustedProxy)

			// Child logger for this request.
			reqLog := logging.RequestLogger(log, reqID, r.Method, r.URL.Path, ip)

			reqLog.Info("incoming request")

			// Store in context.
			ctx := r.Context()
			ctx = context.WithValue(ctx, keyReqID, reqID)
			ctx = context.WithValue(ctx, keyIP, ip)
			ctx = context.WithValue(ctx, keyStartMs, start)
			ctx = logging.WithContext(ctx, reqLog)

			// Wrap response writer to capture status code.
			sw := &statusWriter{ResponseWriter: w, status: 200}

			// Set x-request-id response header (contract: request-logger.ts:36).
			sw.Header().Set("x-request-id", reqID)

			next.ServeHTTP(sw, r.WithContext(ctx))

			latencyMs := time.Since(start).Milliseconds()
			reqLog.Info("request completed",
				"status", sw.status,
				"latencyMs", latencyMs,
			)
		})
	}
}

// ReqID returns the request ID from context.
func ReqID(ctx context.Context) string {
	if v, ok := ctx.Value(keyReqID).(string); ok {
		return v
	}
	return ""
}

// IP returns the client IP from context.
func IP(ctx context.Context) string {
	if v, ok := ctx.Value(keyIP).(string); ok {
		return v
	}
	return "unknown"
}

func extractIP(r *http.Request, trustedProxy bool) string {
	if trustedProxy {
		if xff := r.Header.Get("x-forwarded-for"); xff != "" {
			first, _, _ := strings.Cut(xff, ",")
			if trimmed := strings.TrimSpace(first); trimmed != "" {
				return trimmed
			}
		}
	}
	// Direct socket address.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	if host != "" {
		return host
	}
	return "unknown"
}

// newUUID generates a v4 UUID without importing a third-party package.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// statusWriter wraps http.ResponseWriter to capture the written status code.
type statusWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.wroteHeader {
		w.status = code
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.wroteHeader = true
	}
	return w.ResponseWriter.Write(b)
}
