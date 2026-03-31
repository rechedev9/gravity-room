package handler

import (
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// InsightsHandler serves pre-computed analytics insights.
type InsightsHandler struct {
	Pool *pgxpool.Pool
}

// HandleList handles GET /api/insights?types=volume_trend,frequency,...
// Returns the user's pre-computed insights, optionally filtered by type.
func (h *InsightsHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())

	var types []string
	if raw := r.URL.Query().Get("types"); raw != "" {
		for _, t := range strings.Split(raw, ",") {
			if t = strings.TrimSpace(t); t != "" {
				types = append(types, t)
			}
		}
	}

	insights, err := service.GetInsights(r.Context(), h.Pool, userID, types)
	if err != nil {
		respondJSON(w, r, http.StatusInternalServerError, model.ErrorResponse{
			Error: "failed to fetch insights",
			Code:  "internal_error",
		})
		return
	}

	respondJSON(w, r, 0, model.InsightsListResponse{Data: insights})
}
