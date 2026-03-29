package handler

import (
	"net/http"

	"github.com/reche/gravity-room/apps/go-api/internal/model"
	"github.com/reche/gravity-room/apps/go-api/internal/presence"
	"github.com/reche/gravity-room/apps/go-api/internal/redis"
)

type StatsHandler struct {
	Redis *redis.Client
}

// HandleOnline handles GET /api/stats/online.
// Returns {count: N} when Redis is available, {count: null} otherwise.
// Matches TS routes/stats.ts behavior.
func (h *StatsHandler) HandleOnline(w http.ResponseWriter, r *http.Request) {
	var count *int
	if h.Redis.Available() {
		n, err := presence.CountOnline(r.Context(), h.Redis.Underlying())
		if err == nil {
			c := int(n)
			count = &c
		}
	}
	resp := model.StatsOnlineResponse{Count: count}
	respondJSON(w, r, 0, resp)
}
