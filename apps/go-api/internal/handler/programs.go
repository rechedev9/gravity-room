package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// ProgramHandler holds dependencies for program routes.
type ProgramHandler struct {
	Pool *pgxpool.Pool
}

// HandleCreate handles POST /api/programs.
func (h *ProgramHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "programs.create", userID, 20, time.Minute) {
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
		resp, err = service.CreateCustomInstance(r.Context(), h.Pool, userID, body.DefinitionID, body.Name, body.Config)
	} else {
		resp, err = service.CreateInstance(r.Context(), h.Pool, userID, body.ProgramID, body.Name, body.Config)
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
	if mw.RateLimit(w, "programs.list", userID, 100, time.Minute) {
		return
	}
	cursor := r.URL.Query().Get("cursor")
	limit := 20
	if qLimit := r.URL.Query().Get("limit"); qLimit != "" {
		if parsed, err := strconv.Atoi(qLimit); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	resp, err := service.ListInstances(r.Context(), h.Pool, userID, limit, cursor)
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
	if mw.RateLimit(w, "programs.get", userID, 100, time.Minute) {
		return
	}
	id := chi.URLParam(r, "id")

	resp, err := service.GetInstance(r.Context(), h.Pool, userID, id)
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
	if mw.RateLimit(w, "programs.update", userID, 20, time.Minute) {
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

	resp, err := service.UpdateInstance(r.Context(), h.Pool, userID, id, body.Name, body.Status, body.Config)
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
	if mw.RateLimit(w, "programs.delete", userID, 20, time.Minute) {
		return
	}
	id := chi.URLParam(r, "id")

	err := service.DeleteInstance(r.Context(), h.Pool, userID, id)
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
	if mw.RateLimit(w, "programs.metadata", userID, 20, time.Minute) {
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

	resp, err := service.UpdateInstanceMetadata(r.Context(), h.Pool, userID, id, body.Metadata)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		if err.Error() == "instance not found" {
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
			return
		}
		if err.Error() == "metadata too large" {
			apierror.New(400, "Metadata exceeds 10KB limit", apierror.CodeMetadataTooLarge).Write(w)
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
	if mw.RateLimit(w, "programs.export", userID, 20, time.Minute) {
		return
	}
	id := chi.URLParam(r, "id")

	exported, err := service.ExportInstance(r.Context(), h.Pool, userID, id)
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
	if mw.RateLimit(w, "programs.import", userID, 20, time.Minute) {
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

	resp, err := service.ImportInstance(r.Context(), h.Pool, userID, body)
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
