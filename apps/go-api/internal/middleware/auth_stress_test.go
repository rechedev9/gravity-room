package middleware

// auth_stress_test.go — edge cases and concurrency stress for RequireAuth /
// OptionalAuth / UserID. Runs with -race. No DB or Redis required.
//
// Tensions targeted:
//   - JWT with sub="" must be rejected (code checks sub == "")
//   - Wrong signing algorithm (HS384 vs expected HS256) must be rejected
//   - Malformed Authorization header variants must all 401
//   - Extra / missing dots in JWT must not panic
//   - Very long sub claim is accepted and propagated faithfully
//   - Null bytes / high-bit bytes in token must not panic
//   - 200 concurrent goroutines hammering RequireAuth with mixed tokens
//   - Goroutine count must not grow (presenceRedis == nil → trackPresence no-ops)

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	authStressSeed       = 20260402
	authStressIterations = 2000
)

// ─── BOUNDARY: sub claim edge cases ──────────────────────────────────────────

func TestRequireAuthEmptySub(t *testing.T) {
	t.Parallel()
	// A properly signed, non-expired token with sub="" must be rejected.
	claims := jwt.MapClaims{
		"sub": "",
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler must not be called with empty sub")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("empty sub: status = %d, want 401", rec.Code)
	}
}

func TestRequireAuthMissingSub(t *testing.T) {
	t.Parallel()
	// Token with no sub claim at all.
	claims := jwt.MapClaims{
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler must not be called with missing sub")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing sub: status = %d, want 401", rec.Code)
	}
}

// ─── BOUNDARY: algorithm enforcement ─────────────────────────────────────────

func TestRequireAuthWrongAlgorithmHS384(t *testing.T) {
	t.Parallel()
	// HS384 — valid HMAC family but not HS256. Must be rejected by WithValidMethods.
	claims := jwt.MapClaims{
		"sub": "user-xyz",
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS384, claims).SignedString([]byte(testSecret))

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("HS384 token must not pass")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	handler.ServeHTTP(httptest.NewRecorder(), req)
	// Just verify no panic; also test rec.Code
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("HS384: status = %d, want 401", rec.Code)
	}
}

func TestRequireAuthWrongAlgorithmHS512(t *testing.T) {
	t.Parallel()
	claims := jwt.MapClaims{
		"sub": "user-xyz",
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS512, claims).SignedString([]byte(testSecret))

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("HS512 token must not pass")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("HS512: status = %d, want 401", rec.Code)
	}
}

// ─── BOUNDARY: malformed Authorization header formats ─────────────────────────

func TestRequireAuthMalformedBearerPrefixes(t *testing.T) {
	t.Parallel()
	token := signTestToken("user-1", 15*time.Minute)

	cases := []struct {
		name string
		hdr  string
	}{
		{"lowercase bearer", "bearer " + token},
		{"uppercase BEARER", "BEARER " + token},
		{"Basic scheme", "Basic " + token},
		{"leading space", " Bearer " + token},
		{"scheme only", "Bearer"},
		{"scheme space empty", "Bearer "},
		{"no scheme", token},
		{"tab separator", "Bearer\t" + token},
		{"double space", "Bearer  " + token},
	}

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("handler must not be called with malformed Authorization")
	}))

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Authorization", tc.hdr)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("hdr %q: status = %d, want 401", tc.hdr[:min(len(tc.hdr), 40)], rec.Code)
			}
		})
	}
}

// ─── BOUNDARY: structural token mutations ────────────────────────────────────

func TestRequireAuthExtraDotsInToken(t *testing.T) {
	t.Parallel()
	token := signTestToken("user-1", 15*time.Minute)

	malformed := []struct {
		name string
		tok  string
	}{
		{"extra segment", token + ".extra"},
		{"two segments", "a.b"},
		{"four segments", "a.b.c.d"},
		{"long garbage header", strings.Repeat("a", 1000) + ".b.c"},
		{"two dots only", ".."},
		{"three dots only", "..."},
		{"just a dot", "."},
	}

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("malformed token must not reach handler")
	}))

	for _, tc := range malformed {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Authorization", "Bearer "+tc.tok)
			rec := httptest.NewRecorder()
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("panicked on %q: %v", tc.name, r)
					}
				}()
				handler.ServeHTTP(rec, req)
			}()
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("%s: status = %d, want 401", tc.name, rec.Code)
			}
		})
	}
}

func TestRequireAuthHighBitBytesInToken(t *testing.T) {
	t.Parallel()
	// Non-ASCII bytes in the token must not panic.
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("garbage token must not reach handler")
	}))

	garbage := []string{
		"\x00\x00\x00",
		"\xff\xfe\xfd",
		string([]byte{0x80, 0x81, 0x82}),
		strings.Repeat("\xff", 512),
	}

	for _, tok := range garbage {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		rec := httptest.NewRecorder()
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("panicked on high-bit token: %v", r)
				}
			}()
			handler.ServeHTTP(rec, req)
		}()
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("high-bit token: status = %d, want 401", rec.Code)
		}
	}
}

// ─── BOUNDARY: oversized sub claim ───────────────────────────────────────────

func TestRequireAuthVeryLongSubClaim(t *testing.T) {
	t.Parallel()
	// A 64 KB sub — the token itself is enormous. Handler must accept it
	// (it's a valid, properly signed token) and propagate the sub faithfully.
	sub := strings.Repeat("u", 65536)
	claims := jwt.MapClaims{
		"sub": sub,
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))

	var gotSub string
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotSub = UserID(r.Context())
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("long sub: status = %d, want 200", rec.Code)
	}
	if len(gotSub) != len(sub) {
		t.Fatalf("sub truncated: got len=%d, want %d", len(gotSub), len(sub))
	}
}

// ─── BOUNDARY: OptionalAuth edge cases ───────────────────────────────────────

func TestOptionalAuthEmptySub(t *testing.T) {
	t.Parallel()
	claims := jwt.MapClaims{
		"sub": "",
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))

	var called bool
	handler := OptionalAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		called = true
		// Optional — handler is called even if token is invalid; sub must be empty.
		if uid := UserID(r.Context()); uid != "" {
			t.Errorf("userID = %q, want empty for invalid token", uid)
		}
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("OptionalAuth must call handler even for invalid token")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

// ─── FUZZ: random header values never panic ───────────────────────────────────

func TestFuzzAuthHeaderNeverPanics(t *testing.T) {
	t.Parallel()
	t.Logf("seed=%d", authStressSeed)

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))
	validToken := signTestToken("user-fuzz", 15*time.Minute)

	candidates := []string{
		"",
		"Bearer ",
		"Bearer " + strings.Repeat("A", 8192),
		"Bearer " + validToken[:len(validToken)/2],
		"Bearer " + validToken + validToken,
		"Bearer " + strings.ReplaceAll(validToken, ".", ""),
		"\x00",
		strings.Repeat("Bearer ", 100) + validToken,
		"Bearer " + string([]byte{0xff, 0xfe, 0xfd}),
		"Bearer " + strings.Repeat(".", 500),
		"Bearer eyJhbGciOiJub25lIn0.e30.",     // alg:none attack
		"Bearer eyJhbGciOiJIUzI1NiJ9.e30.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c", // wrong secret
	}

	for i, hdr := range candidates {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", hdr)
		rec := httptest.NewRecorder()
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("iter %d: panicked on header len=%d: %v", i, len(hdr), r)
				}
			}()
			handler.ServeHTTP(rec, req)
		}()
	}
}

// ─── CONCURRENCY: fan-in storm — 200 goroutines, valid + expired tokens ───────

func TestConcurrencyRequireAuthFanInStorm(t *testing.T) {
	t.Parallel()

	validToken := signTestToken("user-concurrent", 15*time.Minute)
	expiredToken := signTestToken("user-expired", -1*time.Minute)

	var okCount atomic.Int64
	var failCount atomic.Int64

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		okCount.Add(1)
	}))

	const workers = 200
	var wg sync.WaitGroup
	wg.Add(workers)

	for i := range workers {
		go func(i int) {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if i%3 == 0 {
				req.Header.Set("Authorization", "Bearer "+expiredToken)
			} else {
				req.Header.Set("Authorization", "Bearer "+validToken)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				failCount.Add(1)
			}
		}(i)
	}
	wg.Wait()

	total := okCount.Load() + failCount.Load()
	if total != workers {
		t.Fatalf("lost requests: total = %d, want %d", total, workers)
	}
	t.Logf("ok=%d fail=%d", okCount.Load(), failCount.Load())
}

// ─── CONCURRENCY: OptionalAuth vs RequireAuth race on same token ──────────────

func TestConcurrencyOptionalVsRequireRace(t *testing.T) {
	t.Parallel()

	token := signTestToken("race-user", 15*time.Minute)
	const workers = 100

	require := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))
	optional := OptionalAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))

	var wg sync.WaitGroup
	wg.Add(workers * 2)

	for range workers {
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			require.ServeHTTP(httptest.NewRecorder(), req)
		}()
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			optional.ServeHTTP(httptest.NewRecorder(), req)
		}()
	}
	wg.Wait()
}

// ─── STRESS: goroutine count stable (presenceRedis == nil → no-op) ─────────────

func TestStressGoroutineCountStableNoPresenceRedis(t *testing.T) {
	t.Parallel()
	// presenceRedis is nil in unit tests, so trackPresence returns immediately.
	// Goroutine count must not grow after repeated requests.

	token := signTestToken("goroutine-check", 15*time.Minute)
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))

	// Warm up.
	for range 10 {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	before := runtime.NumGoroutine()
	for range authStressIterations {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	runtime.Gosched()
	time.Sleep(5 * time.Millisecond)
	after := runtime.NumGoroutine()

	if after > before+5 {
		t.Fatalf("goroutine leak: before=%d after=%d after %d requests",
			before, after, authStressIterations)
	}
}

// ─── STRESS: many unique sub values — no goroutine growth ────────────────────

func TestStressManyUniqueSubValues(t *testing.T) {
	t.Parallel()
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))

	before := runtime.NumGoroutine()
	for i := range 1000 {
		tok := signTestToken(fmt.Sprintf("user-%d", i), 15*time.Minute)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	runtime.Gosched()
	time.Sleep(5 * time.Millisecond)
	after := runtime.NumGoroutine()

	if after > before+5 {
		t.Fatalf("goroutine leak: before=%d after=%d", before, after)
	}
}
