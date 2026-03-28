package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/config"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	cfg := &config.Config{
		Port:            0,
		Env:             "test",
		CORSOrigins:     []string{"http://localhost:3000"},
		JWTSecret:       "test-secret-for-unit-tests-must-be-long-enough-64-chars-minimum!",
		JWTAccessExpiry: "15m",
	}
	return New(cfg, logging.NewTestLogger(), nil)
}

// rawHealth mirrors the harness Zod schema for testing exact JSON shape.
type rawHealth struct {
	Status    string                 `json:"status"`
	Timestamp string                 `json:"timestamp"`
	Uptime    float64                `json:"uptime"`
	DB        map[string]any         `json:"db"`
	Redis     map[string]any         `json:"redis"`
}

func getHealth(t *testing.T, s *Server) (*httptest.ResponseRecorder, rawHealth) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)

	var body rawHealth
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return rec, body
}

func TestHealthStatus200(t *testing.T) {
	s := testServer(t)
	rec, body := getHealth(t, s)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body.Status != "ok" {
		t.Errorf("status = %q, want ok", body.Status)
	}
}

func TestHealthTimestampISO(t *testing.T) {
	s := testServer(t)
	_, body := getHealth(t, s)

	if _, err := time.Parse(time.RFC3339Nano, body.Timestamp); err != nil {
		t.Errorf("timestamp %q is not valid ISO: %v", body.Timestamp, err)
	}
}

func TestHealthDBShape(t *testing.T) {
	s := testServer(t)
	_, body := getHealth(t, s)

	if body.DB["status"] != "ok" {
		t.Errorf("db.status = %v, want ok", body.DB["status"])
	}
	// latencyMs must be present (Zod strict: DbStatusOk requires it)
	if _, ok := body.DB["latencyMs"]; !ok {
		t.Error("db.latencyMs must be present")
	}
	// Must not have extra fields
	if len(body.DB) != 2 {
		t.Errorf("db has %d fields, want exactly 2 (status, latencyMs)", len(body.DB))
	}
}

func TestHealthRedisDisabled(t *testing.T) {
	s := testServer(t)
	_, body := getHealth(t, s)

	if body.Redis["status"] != "disabled" {
		t.Errorf("redis.status = %v, want disabled", body.Redis["status"])
	}
	// RedisStatusDisabled is strict: only {status: "disabled"}
	if len(body.Redis) != 1 {
		t.Errorf("redis has %d fields, want exactly 1 (status)", len(body.Redis))
	}
}

func TestHealthContentType(t *testing.T) {
	s := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)

	ct := rec.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}
}

func TestHealthUptimeNonNegative(t *testing.T) {
	s := testServer(t)
	_, body := getHealth(t, s)

	if body.Uptime < 0 {
		t.Errorf("uptime = %f, want >= 0", body.Uptime)
	}
}

func TestHealthTopLevelFieldCount(t *testing.T) {
	s := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)

	var raw map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&raw); err != nil {
		t.Fatal(err)
	}
	// Zod .strict() — exactly 5 top-level fields
	if len(raw) != 5 {
		t.Errorf("top-level fields = %d, want 5; keys: %v", len(raw), keys(raw))
	}
}

func keys(m map[string]any) []string {
	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	return ks
}
