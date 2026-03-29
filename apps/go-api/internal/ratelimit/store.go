package ratelimit

import "time"

// Store is the rate-limiting backend. Implementations must be safe for
// concurrent use. Check returns true when the request is allowed.
type Store interface {
	Check(key string, limit int, window time.Duration) bool
}
