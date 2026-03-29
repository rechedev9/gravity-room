package ratelimit

import (
	"testing"
	"time"
)

func TestMemoryStoreAllows(t *testing.T) {
	s := NewMemoryStore()
	key := "rl:test.allows:" + t.Name()
	for i := 0; i < 5; i++ {
		if !s.Check(key, 5, time.Minute) {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
}

func TestMemoryStoreBlocks(t *testing.T) {
	s := NewMemoryStore()
	key := "rl:test.blocks:" + t.Name()
	for i := 0; i < 3; i++ {
		s.Check(key, 3, time.Minute)
	}
	if s.Check(key, 3, time.Minute) {
		t.Fatal("4th request should be blocked")
	}
}

func TestMemoryStoreWindowReset(t *testing.T) {
	s := NewMemoryStore()
	key := "rl:test.reset:" + t.Name()
	// Fill the window.
	for i := 0; i < 2; i++ {
		s.Check(key, 2, 10*time.Millisecond)
	}
	if s.Check(key, 2, 10*time.Millisecond) {
		t.Fatal("should be blocked before window expires")
	}
	// Wait for window to expire.
	time.Sleep(15 * time.Millisecond)
	if !s.Check(key, 2, 10*time.Millisecond) {
		t.Fatal("should be allowed after window reset")
	}
}
