package handler

import (
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

// ResultHandler holds dependencies for result routes.
type ResultHandler struct {
	Pool *pgxpool.Pool
}

// HandleRecord handles POST /api/programs/{id}/results.
func (h *ResultHandler) HandleRecord(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "results.record", userID) {
		return
	}
	instanceID := chi.URLParam(r, "id")

	var body struct {
		WorkoutIndex int    `json:"workoutIndex"`
		SlotID       string `json:"slotId"`
		Result       string `json:"result"`
		AmrapReps    *int   `json:"amrapReps,omitempty"`
		RPE          *int   `json:"rpe,omitempty"`
		SetLogs      any    `json:"setLogs,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	if body.SlotID == "" || body.Result == "" {
		apierror.New(422, "slotId and result are required", apierror.CodeValidationError).Write(w)
		return
	}

	entry, err := service.RecordResult(r.Context(), h.Pool, userID, instanceID, body.WorkoutIndex, body.SlotID, body.Result, body.AmrapReps, body.RPE, body.SetLogs)
	if err != nil {
		if err.Error() == "instance not found" {
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("record result failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 201, entry)
}

// HandleDeleteResult handles DELETE /api/programs/{id}/results/{workoutIndex}/{slotId}.
func (h *ResultHandler) HandleDeleteResult(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "results.delete", userID) {
		return
	}
	instanceID := chi.URLParam(r, "id")
	slotID := chi.URLParam(r, "slotId")

	workoutIndex, err := strconv.Atoi(chi.URLParam(r, "workoutIndex"))
	if err != nil {
		apierror.New(422, "workoutIndex must be a number", apierror.CodeValidationError).Write(w)
		return
	}

	delErr := service.DeleteResult(r.Context(), h.Pool, userID, instanceID, workoutIndex, slotID)
	if delErr != nil {
		switch delErr.Error() {
		case "instance not found":
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
		case "result not found":
			apierror.New(404, "Result not found", apierror.CodeResultNotFound).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("delete result failed", "err", delErr)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	w.WriteHeader(204)
}

// HandleUndo handles POST /api/programs/{id}/undo.
func (h *ResultHandler) HandleUndo(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "results.undo", userID) {
		return
	}
	instanceID := chi.URLParam(r, "id")

	undone, err := service.UndoLast(r.Context(), h.Pool, userID, instanceID)
	if err != nil {
		if err.Error() == "instance not found" {
			apierror.New(404, "Program not found", apierror.CodeInstanceNotFound).Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("undo failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	resp := model.UndoResponse{Undone: undone}
	respondJSON(w, r, 0, resp)
}
