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
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// DefinitionHandler holds dependencies for program definition routes.
type DefinitionHandler struct {
	Pool         *pgxpool.Pool
	AdminUserIDs []string
}

// HandleCreate handles POST /api/program-definitions.
func (h *DefinitionHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.create", userID, 5, time.Hour) {
		return
	}

	var body struct {
		Definition any `json:"definition"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	resp, err := service.CreateDefinition(r.Context(), h.Pool, userID, body.Definition)
	if err != nil {
		switch err.Error() {
		case "limit exceeded":
			apierror.New(409, "Definition limit reached", apierror.CodeLimitExceeded).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("create definition failed", "err", err)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	respondJSON(w, r, 201, resp)
}

// HandleList handles GET /api/program-definitions.
func (h *DefinitionHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.list", userID, 100, time.Minute) {
		return
	}
	q := r.URL.Query()

	limit := 20
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 100 {
			limit = n
		}
	}
	offset := 0
	if v := q.Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	resp, err := service.ListDefinitions(r.Context(), h.Pool, userID, limit, offset)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("list definitions failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleGet handles GET /api/program-definitions/{id}.
func (h *DefinitionHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.get", userID, 100, time.Minute) {
		return
	}
	id := chi.URLParam(r, "id")

	resp, err := service.GetDefinition(r.Context(), h.Pool, userID, id)
	if err != nil {
		apierror.New(404, "Definition not found", apierror.CodeNotFound).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleUpdate handles PUT /api/program-definitions/{id}.
func (h *DefinitionHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.update", userID, 20, time.Hour) {
		return
	}
	id := chi.URLParam(r, "id")

	var body struct {
		Definition any `json:"definition"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	resp, err := service.UpdateDefinition(r.Context(), h.Pool, userID, id, body.Definition)
	if err != nil {
		apierror.New(404, "Definition not found", apierror.CodeNotFound).Write(w)
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleDelete handles DELETE /api/program-definitions/{id}.
func (h *DefinitionHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.delete", userID, 20, time.Hour) {
		return
	}
	id := chi.URLParam(r, "id")

	err := service.DeleteDefinition(r.Context(), h.Pool, userID, id)
	if err != nil {
		switch err.Error() {
		case "active instances exist":
			apierror.New(409, "Cannot delete definition with active program instances", apierror.CodeActiveInstancesExist).Write(w)
		case "not found":
			apierror.New(404, "Definition not found", apierror.CodeNotFound).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("delete definition failed", "err", err)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	w.WriteHeader(204)
}

// HandleStatusUpdate handles PATCH /api/program-definitions/{id}/status.
func (h *DefinitionHandler) HandleStatusUpdate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.status", userID, 20, time.Hour) {
		return
	}
	id := chi.URLParam(r, "id")

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	isAdmin := false
	for _, adminID := range h.AdminUserIDs {
		if adminID == userID {
			isAdmin = true
			break
		}
	}

	resp, err := service.UpdateDefinitionStatus(r.Context(), h.Pool, userID, id, body.Status, isAdmin)
	if err != nil {
		switch err.Error() {
		case "not found":
			apierror.New(404, "Definition not found", apierror.CodeNotFound).Write(w)
		case "invalid transition":
			apierror.New(403, "Invalid status transition", apierror.CodeInvalidTransition).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("update definition status failed", "err", err)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	respondJSON(w, r, 0, resp)
}

// HandleFork handles POST /api/program-definitions/fork.
func (h *DefinitionHandler) HandleFork(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "definitions.fork", userID, 10, time.Hour) {
		return
	}

	var body struct {
		SourceID   string `json:"sourceId"`
		SourceType string `json:"sourceType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	resp, err := service.ForkDefinition(r.Context(), h.Pool, userID, body.SourceID, body.SourceType)
	if err != nil {
		switch err.Error() {
		case "not found":
			apierror.New(404, "Source not found", apierror.CodeNotFound).Write(w)
		case "forbidden":
			apierror.New(403, "Forbidden", apierror.CodeForbidden).Write(w)
		case "limit exceeded":
			apierror.New(409, "Definition limit reached", apierror.CodeLimitExceeded).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("fork definition failed", "err", err)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	respondJSON(w, r, 201, resp)
}
