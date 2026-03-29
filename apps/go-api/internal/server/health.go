package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/db"
)

// healthResponse matches the TS contract (http-contract.md §8, harness schemas/system.ts).
// The harness uses Zod .strict() so each variant must have exactly the right fields.
type healthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Uptime    int    `json:"uptime"`
	DB        any    `json:"db"`
	Redis     any    `json:"redis"`
}

// Typed variants — each serializes to exactly the Zod-expected shape.
type redisDisabled struct {
	Status string `json:"status"`
}

type redisOk struct {
	Status    string `json:"status"`
	LatencyMs int    `json:"latencyMs"`
}

type redisError struct {
	Status string `json:"status"`
	Error  string `json:"error"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	// Real DB probe via pgxpool.
	dbResult := db.Probe(r.Context(), s.pool)

	// Redis probe — matches TS create-app.ts health handler.
	var redisResult any
	if !s.redis.Available() {
		redisResult = redisDisabled{Status: "disabled"}
	} else {
		latency, err := s.redis.Ping(r.Context())
		if err != nil {
			s.log.Error("redis health check failed", "err", err)
			redisResult = redisError{Status: "error", Error: "Unavailable"}
		} else {
			redisResult = redisOk{Status: "ok", LatencyMs: int(latency.Milliseconds())}
		}
	}

	resp := healthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Uptime:    s.Uptime(),
		DB:        dbResult,
		Redis:     redisResult,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		s.log.Error("failed to encode health response", "err", err)
	}
}
