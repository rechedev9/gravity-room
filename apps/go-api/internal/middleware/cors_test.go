package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func corsRouter(origins []string) *chi.Mux {
	r := chi.NewRouter()
	r.Use(CORS(origins))
	r.Get("/test", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	return r
}

func TestCORS_PreflightAllowedOrigin(t *testing.T) {
	r := corsRouter([]string{"http://localhost:3000"})
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("Allow-Origin = %q, want http://localhost:3000", rec.Header().Get("Access-Control-Allow-Origin"))
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("missing Allow-Credentials: true")
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	r := corsRouter([]string{"http://localhost:3000"})
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") == "http://evil.com" {
		t.Error("should not allow http://evil.com")
	}
}

func TestCORS_MirrorsRequestHeaders(t *testing.T) {
	r := corsRouter([]string{"http://localhost:3000"})
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Authorization, Content-Type")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	allowed := rec.Header().Get("Access-Control-Allow-Headers")
	if allowed == "" {
		t.Error("expected Access-Control-Allow-Headers to be set")
	}
}
