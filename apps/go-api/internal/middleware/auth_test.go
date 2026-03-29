package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-for-unit-tests-must-be-long-enough-64-chars-minimum!"

func signTestToken(userID string, expiry time.Duration) string {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(expiry).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString([]byte(testSecret))
	return s
}

func TestRequireAuthValidToken(t *testing.T) {
	token := signTestToken("user-123", 15*time.Minute)

	var gotUserID string
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotUserID = UserID(r.Context())
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if gotUserID != "user-123" {
		t.Errorf("userID = %q, want user-123", gotUserID)
	}
}

func TestRequireAuthMissingHeader(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestRequireAuthInvalidToken(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestRequireAuthExpiredToken(t *testing.T) {
	token := signTestToken("user-123", -1*time.Minute) // expired

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestOptionalAuthValidToken(t *testing.T) {
	token := signTestToken("user-456", 15*time.Minute)

	var gotUserID string
	handler := OptionalAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotUserID = UserID(r.Context())
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if gotUserID != "user-456" {
		t.Errorf("userID = %q, want user-456", gotUserID)
	}
}

func TestOptionalAuthMissingHeader(t *testing.T) {
	var called bool
	handler := OptionalAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		called = true
		if uid := UserID(r.Context()); uid != "" {
			t.Errorf("userID = %q, want empty", uid)
		}
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("handler should be called even without auth")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestOptionalAuthInvalidToken(t *testing.T) {
	var called bool
	handler := OptionalAuth(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		called = true
		if uid := UserID(r.Context()); uid != "" {
			t.Errorf("userID = %q, want empty", uid)
		}
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer invalid")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("handler should be called even with invalid token")
	}
}

func TestUserIDContextEmpty(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if uid := UserID(req.Context()); uid != "" {
		t.Errorf("UserID on fresh context = %q, want empty", uid)
	}
}
