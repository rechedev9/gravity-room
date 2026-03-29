package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func TestHandleCreateMissingBody(t *testing.T) {
	h := &ProgramHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeValidationError {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeValidationError)
	}
}

func TestHandleCreateMissingName(t *testing.T) {
	h := &ProgramHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs", strings.NewReader(`{"programId":"gzclp"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeValidationError {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeValidationError)
	}
}

func TestHandleCreateAmbiguousSource(t *testing.T) {
	h := &ProgramHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs", strings.NewReader(`{"name":"My Program","programId":"gzclp","definitionId":"custom-1"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeAmbiguousSource {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeAmbiguousSource)
	}
}

func TestHandleCreateMissingSource(t *testing.T) {
	h := &ProgramHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs", strings.NewReader(`{"name":"My Program"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeMissingProgramSource {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeMissingProgramSource)
	}
}
