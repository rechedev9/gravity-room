package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// ExerciseHandler holds dependencies for exercise routes.
type ExerciseHandler struct {
	Pool *pgxpool.Pool
}

// HandleList handles GET /api/exercises.
func (h *ExerciseHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context()) // may be empty for unauthenticated
	ip := mw.IP(r.Context())
	rlKey := ip
	if userID != "" {
		rlKey = userID + ":" + ip
	}
	if rateLimit(w, "exercises.list", rlKey) {
		return
	}
	q := r.URL.Query()

	limit := queryInt(q, "limit", 100)
	if limit < 1 {
		limit = 1
	}
	if limit > 1000 {
		limit = 1000
	}
	offset := queryInt(q, "offset", 0)
	if offset < 0 {
		offset = 0
	}

	filters := service.ExerciseFilters{
		Q:             q.Get("q"),
		MuscleGroupID: q.Get("muscleGroupId"),
		Equipment:     q.Get("equipment"),
		Force:         q.Get("force"),
		Level:         q.Get("level"),
		Mechanic:      q.Get("mechanic"),
		Category:      q.Get("category"),
		IsCompound:    q.Get("isCompound"),
	}

	resp, err := service.ListExercises(r.Context(), h.Pool, userID, filters, offset, limit)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("list exercises failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	if userID == "" {
		w.Header().Set("Cache-Control", "public, max-age=300")
	}
	respondJSON(w, r, 0, resp)
}

// HandleCreate handles POST /api/exercises.
func (h *ExerciseHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "exercises.create", userID) {
		return
	}

	var body struct {
		Name          string `json:"name"`
		MuscleGroupID string `json:"muscleGroupId"`
		Equipment     string `json:"equipment,omitempty"`
		IsCompound    *bool  `json:"isCompound,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	if body.Name == "" || body.MuscleGroupID == "" {
		apierror.New(422, "name and muscleGroupId are required", apierror.CodeValidationError).Write(w)
		return
	}

	isCompound := false
	if body.IsCompound != nil {
		isCompound = *body.IsCompound
	}

	entry, err := service.CreateExercise(r.Context(), h.Pool, userID, body.Name, body.MuscleGroupID, body.Equipment, isCompound)
	if err != nil {
		switch err.Error() {
		case "invalid muscle group":
			apierror.New(422, "Invalid muscle group", apierror.CodeValidationError).Write(w)
		case "duplicate":
			apierror.New(409, "Exercise already exists", apierror.CodeDuplicate).Write(w)
		case "invalid slug":
			apierror.New(422, "Exercise name must contain at least one alphanumeric character", apierror.CodeInvalidSlug).Write(w)
		default:
			log := logging.FromContext(r.Context())
			log.Error("create exercise failed", "err", err)
			apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		}
		return
	}

	respondJSON(w, r, 201, entry)
}

// HandleMuscleGroups handles GET /api/muscle-groups.
func (h *ExerciseHandler) HandleMuscleGroups(w http.ResponseWriter, r *http.Request) {
	if rateLimit(w, "muscle-groups.list", mw.IP(r.Context())) {
		return
	}
	groups, err := service.ListMuscleGroups(r.Context(), h.Pool)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("list muscle groups failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=600")
	respondJSON(w, r, 0, groups)
}

func queryInt(q interface{ Get(string) string }, key string, fallback int) int {
	raw := q.Get(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}
