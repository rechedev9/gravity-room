package ratelimit

import (
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ─── BOUNDARY: MemoryStore.Check ─────────────────────────────────────────────

func TestMemoryStoreCheckBoundary(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		limit  int
		window time.Duration
		calls  int
		want   bool // result of LAST call
	}{
		{name: "limit 0 rejects", limit: 0, window: time.Minute, calls: 1, want: false},
		{name: "limit 1 first allowed", limit: 1, window: time.Minute, calls: 1, want: true},
		{name: "limit 1 second rejected", limit: 1, window: time.Minute, calls: 2, want: false},
		{name: "at limit", limit: 10, window: time.Minute, calls: 10, want: true},
		{name: "over limit", limit: 10, window: time.Minute, calls: 11, want: false},
		{name: "very short window", limit: 100, window: time.Nanosecond, calls: 1, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			store := NewMemoryStore()
			var got bool
			for i := 0; i < tt.calls; i++ {
				got = store.Check("key", tt.limit, tt.window)
			}
			if got != tt.want {
				t.Fatalf("after %d calls: Check = %v, want %v", tt.calls, got, tt.want)
			}
		})
	}
}

func TestMemoryStoreWindowResetAfterExpiry(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()
	window := 10 * time.Millisecond

	// Exhaust limit
	for i := 0; i < 3; i++ {
		store.Check("reset-key", 3, window)
	}
	if store.Check("reset-key", 3, window) {
		t.Fatal("should be rate limited after 3 calls")
	}

	// Wait for window to expire
	time.Sleep(15 * time.Millisecond)

	// Should be allowed again
	if !store.Check("reset-key", 3, window) {
		t.Fatal("should be allowed after window reset")
	}
}

func TestMemoryStoreKeyIsolation(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()

	// Exhaust key A
	for i := 0; i < 5; i++ {
		store.Check("key-a", 5, time.Minute)
	}
	if store.Check("key-a", 5, time.Minute) {
		t.Fatal("key-a should be rate limited")
	}

	// Key B should be independent
	if !store.Check("key-b", 5, time.Minute) {
		t.Fatal("key-b should be allowed")
	}
}

// ─── CONCURRENCY: Fan-in storm ───────────────────────────────────────────────

func TestConcurrencyFanInStorm(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()
	const limit = 100
	const workers = 200
	const key = "storm"

	var allowed atomic.Int64
	var denied atomic.Int64
	var wg sync.WaitGroup
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		go func() {
			defer wg.Done()
			if store.Check(key, limit, time.Minute) {
				allowed.Add(1)
			} else {
				denied.Add(1)
			}
		}()
	}
	wg.Wait()

	a := allowed.Load()
	d := denied.Load()
	total := a + d
	if total != workers {
		t.Fatalf("lost requests: got %d, want %d", total, workers)
	}
	if a > int64(limit) {
		t.Fatalf("over-allowed: %d allowed with limit %d", a, limit)
	}
	if a < 1 {
		t.Fatal("no requests allowed — rate limiter too aggressive")
	}
	t.Logf("allowed=%d denied=%d (limit=%d, workers=%d)", a, d, limit, workers)
}

// ─── CONCURRENCY: Read/write contention on many keys ─────────────────────────

func TestConcurrencyReadWriteContention(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()
	const workers = 100
	const iterations = 500

	var wg sync.WaitGroup
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		w := w
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				key := fmt.Sprintf("key-%d", (w+i)%50) // 50 shared keys
				store.Check(key, 1000, time.Minute)
			}
		}()
	}
	wg.Wait()
}

// ─── CONCURRENCY: Cleanup under load (trigger TOCTOU window) ─────────────────

func TestConcurrencyCleanupUnderLoad(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()
	const workers = 50
	const iterations = 500 // 50*500 = 25000 calls → 250 cleanup triggers

	var wg sync.WaitGroup
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		w := w
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				key := fmt.Sprintf("cleanup-%d-%d", w, i)
				store.Check(key, 1, 1*time.Millisecond) // very short window → entries expire fast
			}
		}()
	}
	wg.Wait()
	// If we get here without panic/deadlock, the cleanup is safe under load
}

// ─── STRESS: Rapid create/check cycles for leak detection ────────────────────

func TestStressRapidCreateCheckCycles(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()

	before := runtime.NumGoroutine()
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("stress-%d", i)
		store.Check(key, 10, time.Minute)
	}
	after := runtime.NumGoroutine()

	if after > before+5 {
		t.Fatalf("goroutine leak: before=%d, after=%d", before, after)
	}
}

// ─── STRESS: Same key hammered from many goroutines ──────────────────────────

func TestStressSameKeyContention(t *testing.T) {
	t.Parallel()
	store := NewMemoryStore()
	const limit = 50
	const workers = 100
	const iterations = 100

	var total atomic.Int64
	var allowed atomic.Int64
	var wg sync.WaitGroup
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				total.Add(1)
				if store.Check("hot-key", limit, time.Minute) {
					allowed.Add(1)
				}
			}
		}()
	}
	wg.Wait()

	a := allowed.Load()
	if a > int64(limit) {
		t.Fatalf("over-allowed: %d with limit %d", a, limit)
	}
	t.Logf("total=%d allowed=%d (limit=%d)", total.Load(), a, limit)
}
