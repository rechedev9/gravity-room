package middleware

import (
	"net/http"
	"time"

	m "github.com/reche/gravity-room/apps/go-api/internal/metrics"
)

// Metrics is a chi middleware that records request duration and count.
// Matches TS plugins/metrics.ts onRequest + onAfterHandle hooks.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap to capture status.
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)

		route := m.NormaliseRoute(r.URL.Path)
		method := r.Method
		status := m.StatusStr(sw.status)
		duration := time.Since(start).Seconds()

		m.HTTPRequestDuration.WithLabelValues(method, route, status).Observe(duration)
		m.HTTPRequestsTotal.WithLabelValues(method, route, status).Inc()
	})
}
