package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func TestHandleRecordMissingFields(t *testing.T) {
	h := &ResultHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs/some-id/results", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "some-id")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rec := httptest.NewRecorder()

	h.HandleRecord(rec, req)

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

func TestHandleRecordMissingSlotID(t *testing.T) {
	h := &ResultHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/programs/some-id/results", strings.NewReader(`{"result":"success"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "some-id")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rec := httptest.NewRecorder()

	h.HandleRecord(rec, req)

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

func TestHandleDeleteResultInvalidWorkoutIndex(t *testing.T) {
	h := &ResultHandler{}
	req := httptest.NewRequest(http.MethodDelete, "/api/programs/some-id/results/abc/slot-1", nil)
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "some-id")
	rctx.URLParams.Add("workoutIndex", "abc")
	rctx.URLParams.Add("slotId", "slot-1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rec := httptest.NewRecorder()

	h.HandleDeleteResult(rec, req)

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
