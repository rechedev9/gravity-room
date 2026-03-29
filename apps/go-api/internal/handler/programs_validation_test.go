package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
)

func TestHandleUpdateValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "invalid JSON", body: `not json`},
		{name: "name too long", body: `{"name":"` + strings.Repeat("x", 101) + `"}`},
		{name: "empty name", body: `{"name":""}`},
		{name: "invalid status", body: `{"status":"deleted"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &ProgramHandler{}
			req := newReqWithID(http.MethodPatch, "/api/programs/some-id", tt.body, "some-id")
			rec := httptest.NewRecorder()

			h.HandleUpdate(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}

func TestHandleUpdateMetadataValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing metadata", body: `{}`},
		{name: "invalid JSON", body: `not json`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &ProgramHandler{}
			req := newReqWithID(http.MethodPatch, "/api/programs/some-id/metadata", tt.body, "some-id")
			rec := httptest.NewRecorder()

			h.HandleUpdateMetadata(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}

func TestHandleImportValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "invalid JSON", body: `not json`},
		{name: "wrong version", body: `{"version":2,"programId":"gzclp","name":"My GZCLP"}`},
		{name: "missing version", body: `{"programId":"gzclp","name":"My GZCLP"}`},
		{name: "missing programId", body: `{"version":1,"name":"My GZCLP"}`},
		{name: "missing name", body: `{"version":1,"programId":"gzclp"}`},
		{name: "name too long", body: `{"version":1,"programId":"gzclp","name":"` + strings.Repeat("x", 101) + `"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &ProgramHandler{}
			req := newReq(http.MethodPost, "/api/programs/import", tt.body)
			rec := httptest.NewRecorder()

			h.HandleImport(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}

func TestHandleCreateInvalidJSON(t *testing.T) {
	h := &ProgramHandler{}
	req := newReq(http.MethodPost, "/api/programs", `not json`)
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	assertStatus(t, rec, http.StatusUnprocessableEntity)
	assertCode(t, rec, apierror.CodeValidationError)
}
