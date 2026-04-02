package handler

// fuzz_test.go — boundary, fuzz, and stress tests for handler-layer input
// parsing. All tests run without a database (only validation paths that
// short-circuit before the service layer).
//
// Tensions targeted:
//   - queryInt: fallback on non-numeric, overflow, negative, zero, INT_MAX
//   - HandleRecord: WorkoutIndex type coercion (float, string, huge int in JSON)
//   - HandleRecord: SetLogs as deeply nested / huge payload
//   - HandleDeleteResult: workoutIndex URL param overflow and alpha strings
//   - HandleCreate exercise: name/muscleGroupID validation edge cases
//   - All fuzz loops: never panic on arbitrary input

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"runtime"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

const (
	handlerFuzzSeed       = 20260402
	handlerFuzzIterations = 3000
)

// ─── BOUNDARY: queryInt ──────────────────────────────────────────────────────

func TestQueryIntBoundary(t *testing.T) {
	t.Parallel()
	q := func(v string) interface{ Get(string) string } {
		vals := url.Values{"k": {v}}
		return vals
	}

	tests := []struct {
		name     string
		input    string
		fallback int
		want     int
	}{
		{"empty string uses fallback", "", 42, 42},
		{"zero", "0", 99, 0},
		{"one", "1", 99, 1},
		{"negative", "-1", 99, -1},
		{"negative large", "-999999", 0, -999999},
		{"max int32", "2147483647", 0, 2147483647},
		{"min int32", "-2147483648", 0, -2147483648},
		{"max int64", "9223372036854775807", 0, math.MaxInt64},
		{"overflow int64", "9223372036854775808", 5, 5},   // one past MaxInt64 → fallback
		{"huge number", "99999999999999999999", 5, 5},    // definitely overflow
		{"float string", "3.14", 7, 7},                   // not a valid int → fallback
		{"alpha", "abc", 7, 7},
		{"mixed", "12abc", 7, 7},
		{"leading space", " 5", 7, 7},                    // strconv.Atoi rejects spaces
		{"trailing space", "5 ", 7, 7},
		// strconv.Atoi DOES accept '+' prefix — "+5" parses as 5, not fallback.
		{"plus prefix", "+5", 7, 5},
		{"empty spaces", "   ", 7, 7},
		{"100", "100", 0, 100},
		{"1000", "1000", 0, 1000},
		{"1001", "1001", 0, 1001},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := queryInt(q(tt.input), "k", tt.fallback)
			if got != tt.want {
				t.Fatalf("queryInt(%q, fallback=%d) = %d, want %d",
					tt.input, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestQueryIntFuzzNeverPanics(t *testing.T) {
	t.Parallel()
	t.Logf("seed=%d", handlerFuzzSeed)

	// Representative corpus of weird strings — queryInt must never panic.
	corpus := []string{
		"", " ", "\t", "\n", "\x00", "\xff",
		"NaN", "Inf", "-Inf", "+Inf", "∞",
		"0x1f", "0b101", "0o17",
		strings.Repeat("9", 100),
		strings.Repeat("-", 50),
		"1e10", "1.0e3",
		string([]byte{0x80, 0x81, 0x82}),
	}

	q := func(v string) interface{ Get(string) string } {
		return url.Values{"k": {v}}
	}

	for i, s := range corpus {
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("iter %d: panicked on %q: %v", i, s[:min(len(s), 30)], r)
				}
			}()
			_ = queryInt(q(s), "k", 42)
		}()
	}
}

// ─── BOUNDARY: HandleRecord — WorkoutIndex type coercion ─────────────────────
//
// JSON decode rules: a JSON float or string into a Go `int` field returns a
// decode error. Only valid integer literals are accepted. We verify that
// ill-typed workoutIndex values produce 422 before the nil pool is touched.

func TestHandleRecordWorkoutIndexTypeCoercion(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		body string
		want int // expected HTTP status
	}{
		// Float literal — json.Unmarshal rejects non-integer numbers into int.
		{"float workoutIndex", `{"workoutIndex":1.5,"slotId":"x","result":"success"}`, 422},
		// String literal — type mismatch.
		{"string workoutIndex", `{"workoutIndex":"hello","slotId":"x","result":"success"}`, 422},
		// Overflow: larger than MaxInt64 on 64-bit — json decode error.
		{"overflow int", `{"workoutIndex":99999999999999999999,"slotId":"x","result":"success"}`, 422},
		// Array instead of int.
		{"array workoutIndex", `{"workoutIndex":[1,2],"slotId":"x","result":"success"}`, 422},
		// Object instead of int.
		{"object workoutIndex", `{"workoutIndex":{},"slotId":"x","result":"success"}`, 422},
		// Missing required fields — 422 regardless of workoutIndex.
		{"missing slotId", `{"workoutIndex":0,"result":"success"}`, 422},
		{"missing result", `{"workoutIndex":0,"slotId":"x"}`, 422},
		{"both missing", `{"workoutIndex":0}`, 422},
		// Completely invalid JSON.
		{"invalid json", `not json`, 422},
		{"truncated json", `{"workoutIndex":`, 422},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			h := &ResultHandler{} // nil pool — must not be reached
			req := newReqWithID(http.MethodPost, "/api/programs/prog-id/results", tc.body, "prog-id")
			rec := httptest.NewRecorder()

			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("panicked (nil pool reached unexpectedly): %v", r)
					}
				}()
				h.HandleRecord(rec, req)
			}()

			assertStatus(t, rec, tc.want)
			if tc.want == 422 {
				assertCode(t, rec, apierror.CodeValidationError)
			}
		})
	}
}

// ─── BOUNDARY: HandleRecord — SetLogs size extremes ──────────────────────────
//
// SetLogs is `any` — no validation before service call. We can only verify
// that the handler decodes without panic for inputs that fail the
// slotId/result check (so we don't need a pool).

func TestHandleRecordSetLogsShapes(t *testing.T) {
	t.Parallel()
	// All of these are missing slotId or result, so they 422 at validation.
	// Purpose: ensure the JSON decoder does not panic on unusual setLogs shapes.
	bodies := []string{
		`{"workoutIndex":0,"setLogs":null}`,
		`{"workoutIndex":0,"setLogs":[]}`,
		`{"workoutIndex":0,"setLogs":[[1,2,3]]}`,
		fmt.Sprintf(`{"workoutIndex":0,"setLogs":%s}`, strings.Repeat(`{"a":`, 200)+`1`+strings.Repeat(`}`, 200)),
		`{"workoutIndex":0,"setLogs":{"a":{"b":{"c":{"d":{"e":1}}}}}}`,
		`{"workoutIndex":0,"setLogs":true}`,
		`{"workoutIndex":0,"setLogs":99999999999}`,
	}

	for i, body := range bodies {
		t.Run(fmt.Sprintf("shape_%d", i), func(t *testing.T) {
			t.Parallel()
			h := &ResultHandler{}
			req := newReqWithID(http.MethodPost, "/api/programs/p/results", body, "p")
			rec := httptest.NewRecorder()
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("panicked on setLogs shape %d: %v", i, r)
					}
				}()
				h.HandleRecord(rec, req)
			}()
			// All bodies are missing slotId and/or result → 422
			assertStatus(t, rec, http.StatusUnprocessableEntity)
		})
	}
}

// ─── FUZZ: HandleRecord — random JSON bodies never panic ─────────────────────

func TestFuzzHandleRecordNeverPanics(t *testing.T) {
	t.Parallel()
	t.Logf("seed=%d", handlerFuzzSeed)

	h := &ResultHandler{}

	// Bodies that all fail validation (no slotId) so nil pool is never reached.
	// Vary the workoutIndex and setLogs shape randomly.
	bodies := []string{
		`{}`,
		`{"slotId":""}`,
		`{"result":""}`,
		`null`,
		`[]`,
		`""`,
		`0`,
		strings.Repeat(`{"a":`, 500) + `1` + strings.Repeat(`}`, 500),
		`{"workoutIndex":` + strings.Repeat("9", 500) + `}`,
		`{"workoutIndex":0,"slotId":` + `"` + strings.Repeat("x", 100000) + `"` + `}`,
	}

	for i, body := range bodies {
		req := newReqWithID(http.MethodPost, "/api/programs/p/results", body, "p")
		rec := httptest.NewRecorder()
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("iter %d: panicked: %v", i, r)
				}
			}()
			h.HandleRecord(rec, req)
		}()
	}
}

// ─── BOUNDARY: HandleDeleteResult — workoutIndex URL param ───────────────────

func TestHandleDeleteResultWorkoutIndexBoundary(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name         string
		workoutIndex string
		want         int
	}{
		// Non-numeric → Atoi error → 422
		{"alpha", "abc", 422},
		{"float", "1.5", 422},
		{"empty", "", 422},
		// NOTE: "+1" passes strconv.Atoi (returns 1, nil) and reaches the service.
		// Without a pool this would panic. Tested via integration tests only.
		// {"plus prefix", "+1", 422}, // removed — valid Atoi parse
		{"symbol", "@#$", 422},
		{"hex", "0x1f", 422},
		// Overflow → Atoi error → 422
		{"int64 overflow", "9223372036854775808", 422},
		{"huge positive", strings.Repeat("9", 50), 422},
		{"huge negative", "-" + strings.Repeat("9", 50), 422},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			h := &ResultHandler{}
			// Use a fixed URL — workoutIndex is injected via chi route context only
			// to avoid httptest.NewRequest rejecting URLs with spaces or special chars.
			req := httptest.NewRequest(http.MethodDelete,
				"/api/programs/p/results/PLACEHOLDER/slot-1", nil)
			req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))

			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", "p")
			rctx.URLParams.Add("workoutIndex", tc.workoutIndex)
			rctx.URLParams.Add("slotId", "slot-1")
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			rec := httptest.NewRecorder()
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("panicked on workoutIndex %q: %v", tc.workoutIndex, r)
					}
				}()
				h.HandleDeleteResult(rec, req)
			}()

			assertStatus(t, rec, tc.want)
			if tc.want == 422 {
				assertCode(t, rec, apierror.CodeValidationError)
			}
		})
	}
}

// ─── BOUNDARY: HandleCreate exercise — name / muscleGroupID validation ────────

func TestHandleCreateExerciseValidation(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing name", `{"muscleGroupId":"legs"}`, 422},
		{"empty name", `{"name":"","muscleGroupId":"legs"}`, 422},
		{"missing muscleGroupId", `{"name":"Squat"}`, 422},
		{"empty muscleGroupId", `{"name":"Squat","muscleGroupId":""}`, 422},
		{"both empty", `{"name":"","muscleGroupId":""}`, 422},
		{"empty body", `{}`, 422},
		{"invalid json", `not json`, 422},
		{"truncated json", `{"name":"Sq`, 422},
		{"null body", `null`, 422},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			h := &ExerciseHandler{} // nil pool — must not be reached on validation failure
			req := newAuthReq(http.MethodPost, "/api/exercises", tc.body, "user-test")
			rec := httptest.NewRecorder()

			func() {
				defer func() {
					if r := recover(); r != nil {
						// If we panicked, the nil pool was reached — means validation missed a case.
						t.Fatalf("panicked (validation gap): %v", r)
					}
				}()
				h.HandleCreate(rec, req)
			}()

			assertStatus(t, rec, tc.want)
		})
	}
}

// ─── STRESS: repeated handler invocations — goroutine count stable ────────────

func TestStressHandlerGoroutineCount(t *testing.T) {
	t.Parallel()
	h := &ResultHandler{}

	before := runtime.NumGoroutine()
	for i := range handlerFuzzIterations {
		// Use a body that always fails validation (no slotId) → no DB call.
		body := fmt.Sprintf(`{"workoutIndex":%d}`, i)
		req := newReqWithID(http.MethodPost, "/api/programs/p/results", body, "p")
		rec := httptest.NewRecorder()
		h.HandleRecord(rec, req)
	}

	runtime.Gosched()
	after := runtime.NumGoroutine()
	if after > before+5 {
		t.Fatalf("goroutine leak: before=%d after=%d", before, after)
	}
}
