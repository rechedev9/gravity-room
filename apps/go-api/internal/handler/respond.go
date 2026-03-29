package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// respondJSON writes v as a JSON response. Encode errors are logged but cannot
// change the status code (headers are already sent).
func respondJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	if status != 0 {
		w.WriteHeader(status)
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.WarnContext(r.Context(), "json response encode failed", "err", err)
	}
}
