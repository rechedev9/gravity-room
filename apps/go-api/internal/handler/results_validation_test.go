package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func TestHandleRecordValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing result", body: `{"slotId":"d1-t1"}`},
		{name: "invalid JSON", body: `not json`},
		{name: "missing fields", body: `{}`},
		{name: "missing slotId", body: `{"result":"success"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &ResultHandler{}
			req := newReqWithID(http.MethodPost, "/api/programs/some-id/results", tt.body, "some-id")
			rec := httptest.NewRecorder()

			h.HandleRecord(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}

func TestHandleDeleteResultInvalidWorkoutIndex(t *testing.T) {
	tests := []struct {
		name         string
		workoutIndex string
	}{
		{name: "non-numeric", workoutIndex: "abc"},
		{name: "empty", workoutIndex: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &ResultHandler{}
			req := httptest.NewRequest(http.MethodDelete, "/api/programs/some-id/results/"+tt.workoutIndex+"/slot-1", nil)
			req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))

			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", "some-id")
			rctx.URLParams.Add("workoutIndex", tt.workoutIndex)
			rctx.URLParams.Add("slotId", "slot-1")
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			rec := httptest.NewRecorder()

			h.HandleDeleteResult(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}
