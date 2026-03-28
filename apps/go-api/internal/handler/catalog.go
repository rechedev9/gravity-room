package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/engine"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// CatalogHandler holds dependencies for catalog routes.
type CatalogHandler struct {
	Pool *pgxpool.Pool
}

// HandleList handles GET /api/catalog.
func (h *CatalogHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	if mw.RateLimit(w, "catalog.list", mw.IP(r.Context()), 100, time.Minute) {
		return
	}
	entries, err := service.ListCatalog(r.Context(), h.Pool)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("list catalog failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(entries)
}

// HandlePreview handles POST /api/catalog/preview.
// Requires authentication. Rate limited to 30 requests per hour per user.
func (h *CatalogHandler) HandlePreview(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if mw.RateLimit(w, "catalog.preview", userID, 30, time.Hour) {
		return
	}

	var body struct {
		Definition json.RawMessage `json:"definition"`
		Config     map[string]any  `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(400, "Invalid request body", apierror.CodeParseError).Write(w)
		return
	}

	var def engine.ProgramDefinition
	if err := json.Unmarshal(body.Definition, &def); err != nil {
		apierror.New(422, "Invalid definition", apierror.CodeValidationError).Write(w)
		return
	}

	rows, err := service.PreviewDefinition(def, body.Config)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("preview failed", "err", err)
		apierror.New(422, err.Error(), apierror.CodeValidationError).Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rows)
}

// HandleGetDefinition handles GET /api/catalog/{programId}.
func (h *CatalogHandler) HandleGetDefinition(w http.ResponseWriter, r *http.Request) {
	if mw.RateLimit(w, "catalog.get", mw.IP(r.Context()), 100, time.Minute) {
		return
	}
	programID := chi.URLParam(r, "programId")

	def, err := service.GetCatalogDefinition(r.Context(), h.Pool, programID)
	if err != nil {
		apierror.New(404, "Program not found", apierror.CodeProgramNotFound).Write(w)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(def)
}
