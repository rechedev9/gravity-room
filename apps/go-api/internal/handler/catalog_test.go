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

func TestHandlePreviewInvalidBody(t *testing.T) {
	h := &CatalogHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/catalog/preview", strings.NewReader(`not json`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandlePreview(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeParseError {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeParseError)
	}
}

func TestHandlePreviewMissingDefinition(t *testing.T) {
	h := &CatalogHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/catalog/preview", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandlePreview(rec, req)

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
