package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/config"
	"github.com/reche/gravity-room/apps/go-api/internal/handler"
	m "github.com/reche/gravity-room/apps/go-api/internal/metrics"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
)

// CSP value — verbatim from http-contract.md §3 / bootstrap.ts:48-49.
const CSP = "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'"

// PermissionsPolicy — verbatim from bootstrap.ts:51-52.
const PermissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()"

// Server wraps the HTTP server and router.
type Server struct {
	http   *http.Server
	router chi.Router
	log    *slog.Logger
	cfg    *config.Config
	pool   *pgxpool.Pool
	start  time.Time
}

// New creates a Server with all middleware wired in the contract-mandated order.
// Middleware order (http-contract.md §1):
//  1. CORS
//  2. Metrics
//  3. Security headers
//  4. Request logger (reqId, ip, logging)
//  5. Recovery / error handler
func New(cfg *config.Config, log *slog.Logger, pool *pgxpool.Pool) *Server {
	r := chi.NewRouter()

	accessExpiry, err := service.ParseAccessExpiry(cfg.JWTAccessExpiry)
	if err != nil {
		log.Error("invalid JWT_ACCESS_EXPIRY", "err", err)
		accessExpiry = 15 * time.Minute
	}

	s := &Server{
		router: r,
		log:    log,
		cfg:    cfg,
		pool:   pool,
		start:  time.Now(),
		http: &http.Server{
			Addr:              fmt.Sprintf(":%d", cfg.Port),
			Handler:           r,
			ReadHeaderTimeout: 10 * time.Second,
			MaxHeaderBytes:    1 << 20, // 1 MB — matches TS maxRequestBodySize
		},
	}

	// Global middleware — contract order.
	r.Use(mw.CORS(cfg.CORSOrigins))
	r.Use(mw.Metrics)
	r.Use(mw.SecurityHeaders(mw.SecurityConfig{
		CSP:               CSP,
		PermissionsPolicy: PermissionsPolicy,
		IsProd:            cfg.IsProd(),
	}))
	r.Use(mw.RequestID(cfg.TrustedProxy, log))
	r.Use(mw.Recovery)

	// System endpoints — outside /api prefix.
	r.Get("/health", s.handleHealth)
	r.Get("/metrics", s.handleMetrics)

	// Auth handler.
	auth := &handler.AuthHandler{
		Pool:         pool,
		JWTSecret:    cfg.JWTSecret,
		AccessExpiry: accessExpiry,
		IsProd:       cfg.IsProd(),
	}

	// Program handler.
	prog := &handler.ProgramHandler{
		Pool: pool,
	}

	// Result handler.
	result := &handler.ResultHandler{
		Pool: pool,
	}

	// Catalog handler.
	cat := &handler.CatalogHandler{
		Pool: pool,
	}

	// Exercise handler.
	ex := &handler.ExerciseHandler{
		Pool: pool,
	}

	// Program definitions handler.
	def := &handler.DefinitionHandler{
		Pool:         pool,
		AdminUserIDs: cfg.AdminUserIDs,
	}

	// Stats handler.
	stats := &handler.StatsHandler{}

	// API routes — /api prefix.
	r.Route("/api", func(api chi.Router) {
		// Auth routes — no global auth middleware.
		api.Route("/auth", func(ar chi.Router) {
			ar.Post("/dev", auth.HandleDevLogin)
			ar.Post("/refresh", auth.HandleRefresh)
			ar.With(mw.RequireAuth(cfg.JWTSecret)).Post("/signout", auth.HandleSignout)
			ar.With(mw.RequireAuth(cfg.JWTSecret)).Get("/me", auth.HandleMe)
		})

		// Program routes — require auth.
		api.Route("/programs", func(pr chi.Router) {
			pr.Use(mw.RequireAuth(cfg.JWTSecret))
			pr.Post("/", prog.HandleCreate)
			pr.Get("/", prog.HandleList)
			pr.Get("/{id}", prog.HandleGet)
			pr.Delete("/{id}", prog.HandleDelete)
			pr.Post("/{id}/results", result.HandleRecord)
			pr.Post("/{id}/undo", result.HandleUndo)
		})

		// Catalog routes — preview requires auth, list/get are public.
		api.With(mw.RequireAuth(cfg.JWTSecret)).Post("/catalog/preview", cat.HandlePreview)
		api.Get("/catalog", cat.HandleList)
		api.Get("/catalog/{programId}", cat.HandleGetDefinition)

		// Exercise routes — optional auth for list, required for create.
		api.With(mw.OptionalAuth(cfg.JWTSecret)).Get("/exercises", ex.HandleList)
		api.With(mw.RequireAuth(cfg.JWTSecret)).Post("/exercises", ex.HandleCreate)
		api.Get("/muscle-groups", ex.HandleMuscleGroups)

		// Program definitions — require auth.
		api.Route("/program-definitions", func(dr chi.Router) {
			dr.Use(mw.RequireAuth(cfg.JWTSecret))
			dr.Post("/", def.HandleCreate)
			dr.Get("/", def.HandleList)
			dr.Get("/{id}", def.HandleGet)
			dr.Put("/{id}", def.HandleUpdate)
			dr.Delete("/{id}", def.HandleDelete)
			dr.Patch("/{id}/status", def.HandleStatusUpdate)
			dr.Post("/fork", def.HandleFork)
		})

		// Stats.
		api.Get("/stats/online", stats.HandleOnline)
	})

	// Not-found handler — matches TS create-app.ts:77-81.
	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		apierror.WriteJSON(w, 404, "Not found", apierror.CodeNotFound)
	})

	return s
}

// Router returns the underlying chi.Router for mounting additional routes.
func (s *Server) Router() chi.Router { return s.router }

// Uptime returns seconds since server creation, matching TS Math.floor(process.uptime()).
func (s *Server) Uptime() int { return int(time.Since(s.start).Seconds()) }

// Start begins listening. Blocks until the server stops or errors.
func (s *Server) Start() error {
	s.log.Info("API started", slog.Int("port", s.cfg.Port))
	err := s.http.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}

// Shutdown gracefully drains connections within the given context deadline.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.http.Shutdown(ctx)
}

// handleMetrics serves Prometheus metrics, optionally protected by METRICS_TOKEN.
// Matches TS create-app.ts:166-176.
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if s.cfg.MetricsToken != "" {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer "+s.cfg.MetricsToken {
			apierror.New(401, "Invalid metrics token", apierror.CodeUnauthorized).Write(w)
			return
		}
	}
	promhttp.HandlerFor(m.Registry, promhttp.HandlerOpts{}).ServeHTTP(w, r)
}
