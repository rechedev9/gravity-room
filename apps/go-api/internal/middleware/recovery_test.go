package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func recoveryRouter() *chi.Mux {
	log := logging.NewTestLogger()
	r := chi.NewRouter()
	r.Use(RequestID(false, log))
	r.Use(Recovery)
	return r
}

func TestRecovery_CatchesPanic(t *testing.T) {
	r := recoveryRouter()
	r.Get("/panic", func(_ http.ResponseWriter, _ *http.Request) {
		panic("boom")
	})

	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 500 {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "INTERNAL_ERROR" {
		t.Errorf("code = %q, want INTERNAL_ERROR", body["code"])
	}
	if body["error"] != "Internal server error" {
		t.Errorf("error = %q", body["error"])
	}
}

func TestRecovery_CatchesApiError(t *testing.T) {
	r := recoveryRouter()
	r.Get("/api-error", func(_ http.ResponseWriter, _ *http.Request) {
		panic(apierror.New(429, "Too many requests", apierror.CodeRateLimited).
			WithHeaders(map[string]string{"Retry-After": "60"}))
	})

	req := httptest.NewRequest(http.MethodGet, "/api-error", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 429 {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") != "60" {
		t.Error("missing Retry-After header")
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "RATE_LIMITED" {
		t.Errorf("code = %q, want RATE_LIMITED", body["code"])
	}
}

func TestRecovery_NoPanic(t *testing.T) {
	r := recoveryRouter()
	r.Get("/ok", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}
