package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

func fixtureInstance() *model.ProgramInstanceResponse {
	return &model.ProgramInstanceResponse{
		ID:               "inst-1",
		ProgramID:        "gzclp",
		Name:             "My GZCLP",
		Config:           map[string]any{"unit": "kg"},
		Metadata:         nil,
		Status:           "active",
		Results:          map[string]any{},
		UndoHistory:      []map[string]any{},
		ResultTimestamps: map[string]string{},
		CompletedDates:   map[string]string{},
		CreatedAt:        "2025-01-01T00:00:00.000Z",
		UpdatedAt:        "2025-01-01T00:00:00.000Z",
	}
}

func fixtureList() *model.ProgramListResponse {
	return &model.ProgramListResponse{
		Data: []model.ProgramInstanceListItem{
			{ID: "inst-1", ProgramID: "gzclp", Name: "My GZCLP", Status: "active", CreatedAt: "2025-01-01T00:00:00.000Z", UpdatedAt: "2025-01-01T00:00:00.000Z"},
		},
		NextCursor: nil,
	}
}

// ---------------------------------------------------------------------------
// HandleCreate
// ---------------------------------------------------------------------------

func TestHandleCreate_CatalogHappyPath(t *testing.T) {
	want := fixtureInstance()
	h := &ProgramHandler{
		CreateInstance: func(_ context.Context, _ *pgxpool.Pool, userID, programID, name string, _ any) (*model.ProgramInstanceResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if programID != "gzclp" {
				t.Fatalf("programID = %q, want gzclp", programID)
			}
			if name != "My GZCLP" {
				t.Fatalf("name = %q, want My GZCLP", name)
			}
			return want, nil
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs", `{"programId":"gzclp","name":"My GZCLP","config":{"unit":"kg"}}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	assertStatus(t, rec, 201)
	var got model.ProgramInstanceResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID != want.ID {
		t.Fatalf("id = %q, want %q", got.ID, want.ID)
	}
}

func TestHandleCreate_CustomHappyPath(t *testing.T) {
	want := fixtureInstance()
	want.DefinitionID = ptr("def-1")
	h := &ProgramHandler{
		CreateCustomInstance: func(_ context.Context, _ *pgxpool.Pool, userID, definitionID, name string, _ any) (*model.ProgramInstanceResponse, error) {
			if definitionID != "def-1" {
				t.Fatalf("definitionID = %q, want def-1", definitionID)
			}
			return want, nil
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs", `{"definitionId":"def-1","name":"My Custom"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	assertStatus(t, rec, 201)
}

func TestHandleCreate_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		CreateInstance: func(context.Context, *pgxpool.Pool, string, string, string, any) (*model.ProgramInstanceResponse, error) {
			return nil, apierror.New(409, "Program limit reached", apierror.CodeLimitExceeded)
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs", `{"programId":"gzclp","name":"My GZCLP"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	assertStatus(t, rec, 409)
	assertCode(t, rec, apierror.CodeLimitExceeded)
}

func TestHandleCreate_ServiceGenericError(t *testing.T) {
	h := &ProgramHandler{
		CreateInstance: func(context.Context, *pgxpool.Pool, string, string, string, any) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("connection refused")
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs", `{"programId":"gzclp","name":"My GZCLP"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleCreate(rec, req)

	assertStatus(t, rec, 500)
	assertCode(t, rec, apierror.CodeInternalError)
}

// ---------------------------------------------------------------------------
// HandleList
// ---------------------------------------------------------------------------

func TestHandleList_HappyPath(t *testing.T) {
	want := fixtureList()
	h := &ProgramHandler{
		ListInstances: func(_ context.Context, _ *pgxpool.Pool, userID string, limit int, cursor string) (*model.ProgramListResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if limit != 20 {
				t.Fatalf("limit = %d, want 20", limit)
			}
			return want, nil
		},
	}
	req := newAuthReq(http.MethodGet, "/api/programs", "", "user-1")
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	assertStatus(t, rec, 200)
	var got model.ProgramListResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Data) != 1 {
		t.Fatalf("len(data) = %d, want 1", len(got.Data))
	}
}

func TestHandleList_CustomLimit(t *testing.T) {
	var gotLimit int
	h := &ProgramHandler{
		ListInstances: func(_ context.Context, _ *pgxpool.Pool, _ string, limit int, _ string) (*model.ProgramListResponse, error) {
			gotLimit = limit
			return fixtureList(), nil
		},
	}
	req := newAuthReq(http.MethodGet, "/api/programs?limit=50", "", "user-1")
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	assertStatus(t, rec, 200)
	if gotLimit != 50 {
		t.Fatalf("limit = %d, want 50", gotLimit)
	}
}

func TestHandleList_InvalidCursor(t *testing.T) {
	h := &ProgramHandler{
		ListInstances: func(context.Context, *pgxpool.Pool, string, int, string) (*model.ProgramListResponse, error) {
			return nil, errors.New("invalid cursor")
		},
	}
	req := newAuthReq(http.MethodGet, "/api/programs?cursor=bad", "", "user-1")
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	assertStatus(t, rec, 400)
	assertCode(t, rec, apierror.CodeInvalidCursor)
}

func TestHandleList_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		ListInstances: func(context.Context, *pgxpool.Pool, string, int, string) (*model.ProgramListResponse, error) {
			return nil, apierror.New(403, "Forbidden", apierror.CodeForbidden)
		},
	}
	req := newAuthReq(http.MethodGet, "/api/programs", "", "user-1")
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	assertStatus(t, rec, 403)
	assertCode(t, rec, apierror.CodeForbidden)
}

func TestHandleList_ServiceGenericError(t *testing.T) {
	h := &ProgramHandler{
		ListInstances: func(context.Context, *pgxpool.Pool, string, int, string) (*model.ProgramListResponse, error) {
			return nil, errors.New("db down")
		},
	}
	req := newAuthReq(http.MethodGet, "/api/programs", "", "user-1")
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	assertStatus(t, rec, 500)
	assertCode(t, rec, apierror.CodeInternalError)
}

// ---------------------------------------------------------------------------
// HandleGet
// ---------------------------------------------------------------------------

func TestHandleGet_HappyPath(t *testing.T) {
	want := fixtureInstance()
	h := &ProgramHandler{
		GetInstance: func(_ context.Context, _ *pgxpool.Pool, userID, id string) (*model.ProgramInstanceResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if id != "inst-1" {
				t.Fatalf("id = %q, want inst-1", id)
			}
			return want, nil
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleGet(rec, req)

	assertStatus(t, rec, 200)
	var got model.ProgramInstanceResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID != want.ID {
		t.Fatalf("id = %q, want %q", got.ID, want.ID)
	}
}

func TestHandleGet_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		GetInstance: func(context.Context, *pgxpool.Pool, string, string) (*model.ProgramInstanceResponse, error) {
			return nil, apierror.New(404, "Not found", apierror.CodeInstanceNotFound)
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleGet(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

func TestHandleGet_GenericError(t *testing.T) {
	h := &ProgramHandler{
		GetInstance: func(context.Context, *pgxpool.Pool, string, string) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("timeout")
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleGet(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

// ---------------------------------------------------------------------------
// HandleUpdate
// ---------------------------------------------------------------------------

func TestHandleUpdate_HappyPath(t *testing.T) {
	want := fixtureInstance()
	want.Name = "Renamed"
	h := &ProgramHandler{
		UpdateInstance: func(_ context.Context, _ *pgxpool.Pool, userID, instanceID string, name *string, status *string, config any) (*model.ProgramInstanceResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if instanceID != "inst-1" {
				t.Fatalf("instanceID = %q, want inst-1", instanceID)
			}
			if name == nil || *name != "Renamed" {
				t.Fatal("expected name = Renamed")
			}
			return want, nil
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1", `{"name":"Renamed"}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdate(rec, req)

	assertStatus(t, rec, 200)
}

func TestHandleUpdate_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstance: func(context.Context, *pgxpool.Pool, string, string, *string, *string, any) (*model.ProgramInstanceResponse, error) {
			return nil, apierror.New(409, "Invalid transition", apierror.CodeInvalidTransition)
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1", `{"status":"active"}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdate(rec, req)

	assertStatus(t, rec, 409)
	assertCode(t, rec, apierror.CodeInvalidTransition)
}

func TestHandleUpdate_InstanceNotFound(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstance: func(context.Context, *pgxpool.Pool, string, string, *string, *string, any) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("instance not found")
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1", `{"status":"active"}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdate(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

func TestHandleUpdate_GenericError(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstance: func(context.Context, *pgxpool.Pool, string, string, *string, *string, any) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("db timeout")
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1", `{"status":"active"}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdate(rec, req)

	assertStatus(t, rec, 500)
	assertCode(t, rec, apierror.CodeInternalError)
}

// ---------------------------------------------------------------------------
// HandleDelete
// ---------------------------------------------------------------------------

func TestHandleDelete_HappyPath(t *testing.T) {
	h := &ProgramHandler{
		DeleteInstance: func(_ context.Context, _ *pgxpool.Pool, userID, id string) error {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if id != "inst-1" {
				t.Fatalf("id = %q, want inst-1", id)
			}
			return nil
		},
	}
	req := newAuthReqWithID(http.MethodDelete, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleDelete(rec, req)

	assertStatus(t, rec, 204)
}

func TestHandleDelete_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		DeleteInstance: func(context.Context, *pgxpool.Pool, string, string) error {
			return apierror.New(403, "Forbidden", apierror.CodeForbidden)
		},
	}
	req := newAuthReqWithID(http.MethodDelete, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleDelete(rec, req)

	assertStatus(t, rec, 403)
	assertCode(t, rec, apierror.CodeForbidden)
}

func TestHandleDelete_GenericError(t *testing.T) {
	h := &ProgramHandler{
		DeleteInstance: func(context.Context, *pgxpool.Pool, string, string) error {
			return errors.New("timeout")
		},
	}
	req := newAuthReqWithID(http.MethodDelete, "/api/programs/inst-1", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleDelete(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

// ---------------------------------------------------------------------------
// HandleUpdateMetadata
// ---------------------------------------------------------------------------

func TestHandleUpdateMetadata_HappyPath(t *testing.T) {
	want := fixtureInstance()
	want.Metadata = map[string]any{"key": "value"}
	h := &ProgramHandler{
		UpdateInstanceMetadata: func(_ context.Context, _ *pgxpool.Pool, userID, instanceID string, metadata json.RawMessage) (*model.ProgramInstanceResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if instanceID != "inst-1" {
				t.Fatalf("instanceID = %q, want inst-1", instanceID)
			}
			return want, nil
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1/metadata", `{"metadata":{"key":"value"}}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdateMetadata(rec, req)

	assertStatus(t, rec, 200)
}

func TestHandleUpdateMetadata_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstanceMetadata: func(context.Context, *pgxpool.Pool, string, string, json.RawMessage) (*model.ProgramInstanceResponse, error) {
			return nil, apierror.New(403, "Forbidden", apierror.CodeForbidden)
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1/metadata", `{"metadata":{"k":"v"}}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdateMetadata(rec, req)

	assertStatus(t, rec, 403)
	assertCode(t, rec, apierror.CodeForbidden)
}

func TestHandleUpdateMetadata_InstanceNotFound(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstanceMetadata: func(context.Context, *pgxpool.Pool, string, string, json.RawMessage) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("instance not found")
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1/metadata", `{"metadata":{"k":"v"}}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdateMetadata(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

func TestHandleUpdateMetadata_GenericError(t *testing.T) {
	h := &ProgramHandler{
		UpdateInstanceMetadata: func(context.Context, *pgxpool.Pool, string, string, json.RawMessage) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("db timeout")
		},
	}
	req := newAuthReqWithID(http.MethodPatch, "/api/programs/inst-1/metadata", `{"metadata":{"k":"v"}}`, "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleUpdateMetadata(rec, req)

	assertStatus(t, rec, 500)
	assertCode(t, rec, apierror.CodeInternalError)
}

// ---------------------------------------------------------------------------
// HandleExport
// ---------------------------------------------------------------------------

func TestHandleExport_HappyPath(t *testing.T) {
	want := map[string]any{"version": float64(1), "programId": "gzclp", "name": "My GZCLP"}
	h := &ProgramHandler{
		ExportInstance: func(_ context.Context, _ *pgxpool.Pool, userID, instanceID string) (map[string]any, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if instanceID != "inst-1" {
				t.Fatalf("instanceID = %q, want inst-1", instanceID)
			}
			return want, nil
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1/export", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleExport(rec, req)

	assertStatus(t, rec, 200)
	var got map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["programId"] != "gzclp" {
		t.Fatalf("programId = %v, want gzclp", got["programId"])
	}
}

func TestHandleExport_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		ExportInstance: func(context.Context, *pgxpool.Pool, string, string) (map[string]any, error) {
			return nil, apierror.New(404, "Not found", apierror.CodeInstanceNotFound)
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1/export", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleExport(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

func TestHandleExport_GenericError(t *testing.T) {
	h := &ProgramHandler{
		ExportInstance: func(context.Context, *pgxpool.Pool, string, string) (map[string]any, error) {
			return nil, errors.New("timeout")
		},
	}
	req := newAuthReqWithID(http.MethodGet, "/api/programs/inst-1/export", "", "inst-1", "user-1")
	rec := httptest.NewRecorder()

	h.HandleExport(rec, req)

	assertStatus(t, rec, 404)
	assertCode(t, rec, apierror.CodeInstanceNotFound)
}

// ---------------------------------------------------------------------------
// HandleImport
// ---------------------------------------------------------------------------

func TestHandleImport_HappyPath(t *testing.T) {
	want := fixtureInstance()
	h := &ProgramHandler{
		ImportInstance: func(_ context.Context, _ *pgxpool.Pool, userID string, data map[string]any) (*model.ProgramInstanceResponse, error) {
			if userID != "user-1" {
				t.Fatalf("userID = %q, want user-1", userID)
			}
			if data["programId"] != "gzclp" {
				t.Fatalf("programId = %v, want gzclp", data["programId"])
			}
			return want, nil
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs/import", `{"version":1,"programId":"gzclp","name":"My GZCLP"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleImport(rec, req)

	assertStatus(t, rec, 201)
}

func TestHandleImport_ServiceApiError(t *testing.T) {
	h := &ProgramHandler{
		ImportInstance: func(context.Context, *pgxpool.Pool, string, map[string]any) (*model.ProgramInstanceResponse, error) {
			return nil, apierror.New(422, "Invalid data", apierror.CodeInvalidData)
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs/import", `{"version":1,"programId":"gzclp","name":"My GZCLP"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleImport(rec, req)

	assertStatus(t, rec, 422)
	assertCode(t, rec, apierror.CodeInvalidData)
}

func TestHandleImport_GenericError(t *testing.T) {
	h := &ProgramHandler{
		ImportInstance: func(context.Context, *pgxpool.Pool, string, map[string]any) (*model.ProgramInstanceResponse, error) {
			return nil, errors.New("insert failed")
		},
	}
	req := newAuthReq(http.MethodPost, "/api/programs/import", `{"version":1,"programId":"gzclp","name":"My GZCLP"}`, "user-1")
	rec := httptest.NewRecorder()

	h.HandleImport(rec, req)

	assertStatus(t, rec, 500)
	assertCode(t, rec, apierror.CodeImportFailed)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func ptr(s string) *string { return &s }
