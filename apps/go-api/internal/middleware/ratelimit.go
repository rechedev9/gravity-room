package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/ratelimit"
)

var store ratelimit.Store = ratelimit.NewMemoryStore() // default: in-memory

// SetRateLimitStore replaces the rate limiting backend.
// Must be called before the server starts accepting traffic.
func SetRateLimitStore(s ratelimit.Store) {
	store = s
}

// CheckRateLimit returns true if the request is allowed under the window.
// key should be "rl:<endpoint>:<identity>" where identity is IP or userID.
func CheckRateLimit(key string, limit int, window time.Duration) bool {
	return store.Check(key, limit, window)
}

// RateLimit checks the rate limit and writes a 429 response if exceeded.
// Returns true if the request was blocked (caller should return early).
func RateLimit(w http.ResponseWriter, endpoint string, identity string, limit int, window time.Duration) bool {
	key := fmt.Sprintf("rl:%s:%s", endpoint, identity)
	if !store.Check(key, limit, window) {
		apierror.New(429, "Too many requests", apierror.CodeRateLimited).Write(w)
		return true
	}
	return false
}
