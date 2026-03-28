package handler

import (
	"encoding/json"
	"net/http"

	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

// StatsHandler holds dependencies for stats routes.
type StatsHandler struct{}

// HandleOnline handles GET /api/stats/online.
// Returns {count: null} until Redis is wired (Lote 4).
func (h *StatsHandler) HandleOnline(w http.ResponseWriter, _ *http.Request) {
	resp := model.StatsOnlineResponse{Count: nil}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
