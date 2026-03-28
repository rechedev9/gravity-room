package ratelimit

import (
	"sync"
	"sync/atomic"
	"time"
)

type memoryEntry struct {
	mu          sync.Mutex
	count       int
	window      time.Duration
	windowStart time.Time
}

// MemoryStore is an in-memory fixed-window rate limiter using sync.Map.
// Safe for concurrent use. Matches the original middleware/ratelimit.go logic.
type MemoryStore struct {
	entries      sync.Map
	cleanupCount atomic.Int64
}

// NewMemoryStore creates a MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{}
}

const cleanupEveryN int64 = 100

// Check returns true if the request is allowed under the fixed window.
func (m *MemoryStore) Check(key string, limit int, window time.Duration) bool {
	// Periodic cleanup of expired entries (every 100 calls).
	if m.cleanupCount.Add(1)%cleanupEveryN == 0 {
		now := time.Now()
		m.entries.Range(func(k, v any) bool {
			e := v.(*memoryEntry)
			e.mu.Lock()
			expired := now.Sub(e.windowStart) > e.window*2
			e.mu.Unlock()
			if expired {
				m.entries.Delete(k)
			}
			return true
		})
	}

	actual, _ := m.entries.LoadOrStore(key, &memoryEntry{window: window, windowStart: time.Now()})
	entry := actual.(*memoryEntry)
	entry.mu.Lock()
	defer entry.mu.Unlock()

	if time.Since(entry.windowStart) > window {
		entry.count = 0
		entry.windowStart = time.Now()
	}
	entry.count++
	return entry.count <= limit
}
