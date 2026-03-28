package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func testRouter(trustedProxy bool) *chi.Mux {
	log := logging.NewTestLogger()
	r := chi.NewRouter()
	r.Use(RequestID(trustedProxy, log))
	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-got-req-id", ReqID(r.Context()))
		w.Header().Set("x-got-ip", IP(r.Context()))
		w.WriteHeader(http.StatusOK)
	})
	return r
}

func TestRequestID_GeneratesUUID(t *testing.T) {
	r := testRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	reqID := rec.Header().Get("x-request-id")
	if reqID == "" {
		t.Fatal("expected x-request-id header")
	}
	if !reqIDRe.MatchString(reqID) {
		t.Errorf("generated reqID %q doesn't match pattern", reqID)
	}
}

func TestRequestID_PassthroughValid(t *testing.T) {
	r := testRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("x-request-id", "my-custom-req-id-12345")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("x-request-id") != "my-custom-req-id-12345" {
		t.Errorf("expected passthrough, got %q", rec.Header().Get("x-request-id"))
	}
}

func TestRequestID_RejectsInvalid(t *testing.T) {
	r := testRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("x-request-id", "short") // too short (<8)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("x-request-id") == "short" {
		t.Error("should have rejected too-short request ID")
	}
}

func TestRequestID_IPFromRemoteAddr(t *testing.T) {
	r := testRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("x-got-ip") != "192.168.1.1" {
		t.Errorf("ip = %q, want 192.168.1.1", rec.Header().Get("x-got-ip"))
	}
}

func TestRequestID_IPFromXFF_TrustedProxy(t *testing.T) {
	r := testRouter(true)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("x-forwarded-for", "10.0.0.1, 10.0.0.2")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("x-got-ip") != "10.0.0.1" {
		t.Errorf("ip = %q, want 10.0.0.1", rec.Header().Get("x-got-ip"))
	}
}

func TestRequestID_IgnoresXFF_NoTrust(t *testing.T) {
	r := testRouter(false)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	req.Header.Set("x-forwarded-for", "10.0.0.1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// Should use RemoteAddr, not XFF
	if rec.Header().Get("x-got-ip") != "192.168.1.1" {
		t.Errorf("ip = %q, want 192.168.1.1 (should ignore XFF)", rec.Header().Get("x-got-ip"))
	}
}
