package apierror

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestApiError_Error(t *testing.T) {
	e := New(401, "Missing token", CodeUnauthorized)
	got := e.Error()
	if got != "[401] Missing token (UNAUTHORIZED)" {
		t.Errorf("Error() = %q", got)
	}
}

func TestApiError_Write_JSONShape(t *testing.T) {
	e := New(429, "Too many requests", CodeRateLimited)
	e = e.WithHeaders(map[string]string{"Retry-After": "60"})

	rec := httptest.NewRecorder()
	e.Write(rec)

	if rec.Code != 429 {
		t.Errorf("status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") != "60" {
		t.Error("missing Retry-After header")
	}
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Error("missing Content-Type")
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "Too many requests" {
		t.Errorf("error = %q", body["error"])
	}
	if body["code"] != "RATE_LIMITED" {
		t.Errorf("code = %q", body["code"])
	}
	// Contract: exactly {error, code} — no extra fields
	if len(body) != 2 {
		t.Errorf("body has %d fields, want 2", len(body))
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteJSON(rec, http.StatusNotFound, "Not found", CodeNotFound)

	if rec.Code != 404 {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "Not found" || body["code"] != "NOT_FOUND" {
		t.Errorf("body = %v", body)
	}
}
