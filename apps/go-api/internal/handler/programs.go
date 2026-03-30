package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// ProgramHandler holds dependencies for program routes.
// Function fields override the default service implementation when non-nil (for tests).
type ProgramHandler struct {
	Pool *pgxpool.Pool

	CreateInstance         func(ctx context.Context, pool *pgxpool.Pool, userID, programID, name string, config any) (*model.ProgramInstanceResponse, error)
	CreateCustomInstance   func(ctx context.Context, pool *pgxpool.Pool, userID, definitionID, name string, config any) (*model.ProgramInstanceResponse, error)
	ListInstances          func(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) (*model.ProgramListResponse, error)
	GetInstance            func(ctx context.Context, pool *pgxpool.Pool, userID, id string) (*model.ProgramInstanceResponse, error)
	UpdateInstance         func(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, name *string, status *string, config any) (*model.ProgramInstanceResponse, error)
	UpdateInstanceMetadata func(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string, metadata json.RawMessage) (*model.ProgramInstanceResponse, error)
	ExportInstance         func(ctx context.Context, pool *pgxpool.Pool, userID, instanceID string) (map[string]any, error)
	ImportInstance         func(ctx context.Context, pool *pgxpool.Pool, userID string, data map[string]any) (*model.ProgramInstanceResponse, error)
	DeleteInstance         func(ctx context.Context, pool *pgxpool.Pool, userID, id string) error
}

func (h *ProgramHandler) createInstance(ctx context.Context, userID, programID, name string, config any) (*model.ProgramInstanceResponse, error) {
	if h.CreateInstance != nil {
		return h.CreateInstance(ctx, h.Pool, userID, programID, name, config)
	}
	return service.CreateInstance(ctx, h.Pool, userID, programID, name, config)
}

func (h *ProgramHandler) createCustomInstance(ctx context.Context, userID, definitionID, name string, config any) (*model.ProgramInstanceResponse, error) {
	if h.CreateCustomInstance != nil {
		return h.CreateCustomInstance(ctx, h.Pool, userID, definitionID, name, config)
	}
	return service.CreateCustomInstance(ctx, h.Pool, userID, definitionID, name, config)
}

func (h *ProgramHandler) listInstances(ctx context.Context, userID string, limit int, cursor string) (*model.ProgramListResponse, error) {
	if h.ListInstances != nil {
		return h.ListInstances(ctx, h.Pool, userID, limit, cursor)
	}
	return service.ListInstances(ctx, h.Pool, userID, limit, cursor)
}

func (h *ProgramHandler) getInstance(ctx context.Context, userID, id string) (*model.ProgramInstanceResponse, error) {
	if h.GetInstance != nil {
		return h.GetInstance(ctx, h.Pool, userID, id)
	}
	return service.GetInstance(ctx, h.Pool, userID, id)
}

func (h *ProgramHandler) updateInstance(ctx context.Context, userID, instanceID string, name *string, status *string, config any) (*model.ProgramInstanceResponse, error) {
	if h.UpdateInstance != nil {
		return h.UpdateInstance(ctx, h.Pool, userID, instanceID, name, status, config)
	}
	return service.UpdateInstance(ctx, h.Pool, userID, instanceID, name, status, config)
}

func (h *ProgramHandler) updateInstanceMetadata(ctx context.Context, userID, instanceID string, metadata json.RawMessage) (*model.ProgramInstanceResponse, error) {
	if h.UpdateInstanceMetadata != nil {
		return h.UpdateInstanceMetadata(ctx, h.Pool, userID, instanceID, metadata)
	}
	return service.UpdateInstanceMetadata(ctx, h.Pool, userID, instanceID, metadata)
}

func (h *ProgramHandler) exportInstance(ctx context.Context, userID, instanceID string) (map[string]any, error) {
	if h.ExportInstance != nil {
		return h.ExportInstance(ctx, h.Pool, userID, instanceID)
	}
	return service.ExportInstance(ctx, h.Pool, userID, instanceID)
}

func (h *ProgramHandler) importInstance(ctx context.Context, userID string, data map[string]any) (*model.ProgramInstanceResponse, error) {
	if h.ImportInstance != nil {
		return h.ImportInstance(ctx, h.Pool, userID, data)
	}
	return service.ImportInstance(ctx, h.Pool, userID, data)
}

func (h *ProgramHandler) deleteInstance(ctx context.Context, userID, id string) error {
	if h.DeleteInstance != nil {
		return h.DeleteInstance(ctx, h.Pool, userID, id)
	}
	return service.DeleteInstance(ctx, h.Pool, userID, id)
}

// HandleCreate handles POST /api/programs.
func (h *ProgramHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.create", userID) {
		return
	}

	var body struct {
		ProgramID    string `json:"programId"`
		DefinitionID string `json:"definitionId"`
		Name         string `json:"name"`
		Config       any    `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	if body.Name == "" {
		apierror.New(422, "name is required", apierror.CodeValidationError).Write(w)
		return
	}
	if body.ProgramID != "" && body.DefinitionID != "" {
		apierror.New(422, "Provide either programId or definitionId, not both", apierror.CodeAmbiguousSource).Write(w)
		return
	}

	if body.ProgramID == "" && body.DefinitionID == "" {
		apierror.New(422, "Provide programId or definitionId", apierror.CodeMissingProgramSource).Write(w)
		return
	}

	var (
		resp *model.ProgramInstanceResponse
		err  error
	)
	if body.DefinitionID != "" {
		resp, err = h.createCustomInstance(r.Context(), userID, body.DefinitionID, body.Name, body.Config)
	} else {
		resp, err = h.createInstance(r.Context(), userID, body.ProgramID, body.Name, body.Config)
	}
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("create program failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 201, resp)
}

// HandleList handles GET /api/programs.
func (h *ProgramHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.list", userID) {
		return
	}
	cursor := r.URL.Query().Get("cursor")
	limit := 20
	if qLimit := r.URL.Query().Get("limit"); qLimit != "" {
		if parsed, err := strconv.Atoi(qLimit); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	resp, err := h.listInstances(r.Context(), userID, limit, cursor)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		if err.Error() == "invalid cursor" {
			apierror.New(400, "Invalid cursor", apierror.CodeInvalidCursor).Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("list programs failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleGet handles GET /api/programs/{id}.
func (h *ProgramHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.get", userID) {
		return
	}
	id := chi.URLParam(r, "id")

	resp, err := h.getInstance(r.Context(), userID, id)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleUpdate handles PATCH /api/programs/{id}.
func (h *ProgramHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.update", userID) {
		return
	}
	id := chi.URLParam(r, "id")

	var body struct {
		Name   *string `json:"name"`
		Status *string `json:"status"`
		Config any     `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	// Validate name length.
	if body.Name != nil {
		if len(*body.Name) < 1 || len(*body.Name) > 100 {
			apierror.New(422, "name must be 1-100 characters", apierror.CodeValidationError).Write(w)
			return
		}
	}

	// Validate status enum.
	if body.Status != nil {
		switch *body.Status {
		case "active", "completed", "archived":
			// ok
		default:
			apierror.New(422, "status must be active, completed, or archived", apierror.CodeValidationError).Write(w)
			return
		}
	}

	resp, err := h.updateInstance(r.Context(), userID, id, body.Name, body.Status, body.Config)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		if err.Error() == "instance not found" {
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("update program failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleDelete handles DELETE /api/programs/{id}.
func (h *ProgramHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.delete", userID) {
		return
	}
	id := chi.URLParam(r, "id")

	err := h.deleteInstance(r.Context(), userID, id)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
		return
	}

	w.WriteHeader(204)
}

// HandleUpdateMetadata handles PATCH /api/programs/{id}/metadata.
func (h *ProgramHandler) HandleUpdateMetadata(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.metadata", userID) {
		return
	}
	id := chi.URLParam(r, "id")

	var body struct {
		Metadata json.RawMessage `json:"metadata"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Metadata == nil {
		apierror.New(422, "metadata field is required", apierror.CodeValidationError).Write(w)
		return
	}

	resp, err := h.updateInstanceMetadata(r.Context(), userID, id, body.Metadata)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		if err.Error() == "instance not found" {
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("update metadata failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleExport handles GET /api/programs/{id}/export.
func (h *ProgramHandler) HandleExport(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.export", userID) {
		return
	}
	id := chi.URLParam(r, "id")

	exported, err := h.exportInstance(r.Context(), userID, id)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
		return
	}

	respondJSON(w, r, 0, exported)
}

// HandleImport handles POST /api/programs/import.
func (h *ProgramHandler) HandleImport(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "programs.import", userID) {
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	// Validate version.
	version, _ := body["version"].(float64)
	if version != 1 {
		apierror.New(422, "version must be 1", apierror.CodeValidationError).Write(w)
		return
	}

	// Validate required fields.
	programID, _ := body["programId"].(string)
	name, _ := body["name"].(string)
	if programID == "" || name == "" {
		apierror.New(422, "programId and name are required", apierror.CodeValidationError).Write(w)
		return
	}
	if len(name) > 100 {
		apierror.New(422, "name must be at most 100 characters", apierror.CodeValidationError).Write(w)
		return
	}

	resp, err := h.importInstance(r.Context(), userID, body)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("import program failed", "err", err)
		apierror.New(500, "Import failed", apierror.CodeImportFailed).Write(w)
		return
	}

	respondJSON(w, r, 201, resp)
}
