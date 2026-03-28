package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func securityRouter(isProd bool) *chi.Mux {
	r := chi.NewRouter()
	r.Use(SecurityHeaders(SecurityConfig{
		CSP:               "default-src 'self'",
		PermissionsPolicy: "camera=()",
		IsProd:            isProd,
	}))
	r.Get("/test", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	return r
}

func TestSecurityHeaders_AlwaysPresent(t *testing.T) {
	r := securityRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	checks := map[string]string{
		"x-content-type-options": "nosniff",
		"x-frame-options":       "DENY",
		"referrer-policy":       "strict-origin-when-cross-origin",
		"content-security-policy": "default-src 'self'",
		"permissions-policy":     "camera=()",
	}
	for header, want := range checks {
		got := rec.Header().Get(header)
		if got != want {
			t.Errorf("%s = %q, want %q", header, got, want)
		}
	}
}

func TestSecurityHeaders_HSTSProdOnly(t *testing.T) {
	// Dev: no HSTS
	r := securityRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Header().Get("strict-transport-security") != "" {
		t.Error("HSTS should not be set in dev")
	}

	// Prod: HSTS present
	r = securityRouter(true)
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	want := "max-age=31536000; includeSubDomains"
	if rec.Header().Get("strict-transport-security") != want {
		t.Errorf("HSTS = %q, want %q", rec.Header().Get("strict-transport-security"), want)
	}
}
