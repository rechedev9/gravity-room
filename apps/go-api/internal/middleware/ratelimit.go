package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
)

type rateLimitEntry struct {
	mu          sync.Mutex
	count       int
	window      time.Duration
	windowStart time.Time
}

var (
	rateLimits    sync.Map
	cleanupCount  atomic.Int64
	cleanupEveryN int64 = 100
)

// CheckRateLimit returns true if the request is allowed under the sliding window.
// key should be "rl:<endpoint>:<identity>" where identity is IP or userID.
func CheckRateLimit(key string, limit int, window time.Duration) bool {
	// Periodic cleanup of expired entries (every 100 calls, like TS MemoryRateLimitStore).
	if cleanupCount.Add(1)%cleanupEveryN == 0 {
		now := time.Now()
		rateLimits.Range(func(k, v any) bool {
			e := v.(*rateLimitEntry)
			e.mu.Lock()
			expired := now.Sub(e.windowStart) > e.window*2
			e.mu.Unlock()
			if expired {
				rateLimits.Delete(k)
			}
			return true
		})
	}

	actual, _ := rateLimits.LoadOrStore(key, &rateLimitEntry{window: window, windowStart: time.Now()})
	entry := actual.(*rateLimitEntry)
	entry.mu.Lock()
	defer entry.mu.Unlock()

	if time.Since(entry.windowStart) > window {
		entry.count = 0
		entry.windowStart = time.Now()
	}
	entry.count++
	return entry.count <= limit
}

// RateLimit checks the rate limit and writes a 429 response if exceeded.
// Returns true if the request was blocked (caller should return early).
func RateLimit(w http.ResponseWriter, endpoint string, identity string, limit int, window time.Duration) bool {
	key := fmt.Sprintf("rl:%s:%s", endpoint, identity)
	if !CheckRateLimit(key, limit, window) {
		apierror.New(429, "Too many requests", apierror.CodeRateLimited).Write(w)
		return true
	}
	return false
}
