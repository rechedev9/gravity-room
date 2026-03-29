package handler

import (
	"net/http"
	"time"

	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
)

type rlConfig struct {
	limit    int
	devLimit int // optional: overrides limit when non-zero and isDev is true
	window   time.Duration
}

// rateLimits maps endpoint keys to their rate limit configuration.
var rateLimits = map[string]rlConfig{
	// auth
	"auth.google":  {limit: 10, window: time.Minute},
	"auth.delete":  {limit: 5, window: time.Minute},
	"auth.patch":   {limit: 20, window: time.Minute},
	"auth.me":      {limit: 100, window: time.Minute},
	"auth.refresh": {limit: 20, devLimit: 500, window: time.Minute},
	"auth.signout": {limit: 20, window: time.Minute},

	// programs
	"programs.create":   {limit: 20, window: time.Minute},
	"programs.list":     {limit: 100, window: time.Minute},
	"programs.get":      {limit: 100, window: time.Minute},
	"programs.update":   {limit: 20, window: time.Minute},
	"programs.delete":   {limit: 20, window: time.Minute},
	"programs.metadata": {limit: 20, window: time.Minute},
	"programs.export":   {limit: 20, window: time.Minute},
	"programs.import":   {limit: 20, window: time.Minute},

	// results
	"results.record": {limit: 60, window: time.Minute},
	"results.delete": {limit: 20, window: time.Minute},
	"results.undo":   {limit: 20, window: time.Minute},

	// catalog
	"catalog.list":    {limit: 100, window: time.Minute},
	"catalog.preview": {limit: 30, window: time.Hour},
	"catalog.get":     {limit: 100, window: time.Minute},

	// exercises
	"exercises.list":     {limit: 100, window: time.Minute},
	"exercises.create":   {limit: 20, window: time.Minute},
	"muscle-groups.list": {limit: 100, window: time.Minute},

	// definitions
	"definitions.create": {limit: 5, window: time.Hour},
	"definitions.list":   {limit: 100, window: time.Minute},
	"definitions.get":    {limit: 100, window: time.Minute},
	"definitions.update": {limit: 20, window: time.Hour},
	"definitions.delete": {limit: 20, window: time.Hour},
	"definitions.status": {limit: 20, window: time.Hour},
	"definitions.fork":   {limit: 10, window: time.Hour},
}

// rateLimit looks up the config for the given endpoint and delegates to
// mw.RateLimit. Returns true if the request was blocked (caller should return).
func rateLimit(w http.ResponseWriter, endpoint, identity string) bool {
	cfg := rateLimits[endpoint]
	return mw.RateLimit(w, endpoint, identity, cfg.limit, cfg.window)
}

// rateLimitDev is like rateLimit but uses devLimit when isDev is true and
// devLimit is configured.
func rateLimitDev(w http.ResponseWriter, endpoint, identity string, isDev bool) bool {
	cfg := rateLimits[endpoint]
	limit := cfg.limit
	if isDev && cfg.devLimit > 0 {
		limit = cfg.devLimit
	}
	return mw.RateLimit(w, endpoint, identity, limit, cfg.window)
}
