package middleware

import (
	"testing"
	"time"
)

func TestCheckRateLimitAllows(t *testing.T) {
	key := "rl:test.allows:" + t.Name()
	for i := 0; i < 5; i++ {
		if !CheckRateLimit(key, 5, time.Minute) {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
}

func TestCheckRateLimitBlocks(t *testing.T) {
	key := "rl:test.blocks:" + t.Name()
	for i := 0; i < 3; i++ {
		CheckRateLimit(key, 3, time.Minute)
	}
	if CheckRateLimit(key, 3, time.Minute) {
		t.Fatal("4th request should be blocked")
	}
}

func TestCheckRateLimitWindowReset(t *testing.T) {
	key := "rl:test.reset:" + t.Name()
	// Fill the window.
	for i := 0; i < 2; i++ {
		CheckRateLimit(key, 2, 10*time.Millisecond)
	}
	if CheckRateLimit(key, 2, 10*time.Millisecond) {
		t.Fatal("should be blocked before window expires")
	}
	// Wait for window to expire.
	time.Sleep(15 * time.Millisecond)
	if !CheckRateLimit(key, 2, 10*time.Millisecond) {
		t.Fatal("should be allowed after window reset")
	}
}
