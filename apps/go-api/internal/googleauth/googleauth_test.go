package googleauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
)

func TestVerifyTokenSuccess(t *testing.T) {
	privateKey := mustRSAKey(t)
	server := newJWKSServer(t, privateKey.PublicKey)
	defer server.Close()

	resetTestCache(t, server.URL)

	token := signGoogleToken(t, privateKey, jwt.MapClaims{
		"sub":   "google-sub-123",
		"email": "user@example.com",
		"name":  "Test User",
		"aud":   "test-client-id",
		"iss":   "accounts.google.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	payload, err := VerifyToken(context.Background(), server.Client(), token, "test-client-id")
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if payload.Sub != "google-sub-123" {
		t.Fatalf("Sub = %q, want google-sub-123", payload.Sub)
	}
	if payload.Email != "user@example.com" {
		t.Fatalf("Email = %q, want user@example.com", payload.Email)
	}
	if payload.Name == nil || *payload.Name != "Test User" {
		t.Fatalf("Name = %v, want Test User", payload.Name)
	}
}

func TestVerifyTokenInvalidAudience(t *testing.T) {
	privateKey := mustRSAKey(t)
	server := newJWKSServer(t, privateKey.PublicKey)
	defer server.Close()

	resetTestCache(t, server.URL)

	token := signGoogleToken(t, privateKey, jwt.MapClaims{
		"sub":   "google-sub-123",
		"email": "user@example.com",
		"aud":   "different-client-id",
		"iss":   "accounts.google.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	_, err := VerifyToken(context.Background(), server.Client(), token, "test-client-id")
	assertAPIErrorCode(t, err, apierror.CodeAuthInvalid)
}

func TestVerifyTokenJWKSUnavailable(t *testing.T) {
	privateKey := mustRSAKey(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	resetTestCache(t, server.URL)

	token := signGoogleToken(t, privateKey, jwt.MapClaims{
		"sub":   "google-sub-123",
		"email": "user@example.com",
		"aud":   "test-client-id",
		"iss":   "accounts.google.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	_, err := VerifyToken(context.Background(), server.Client(), token, "test-client-id")
	assertAPIErrorCode(t, err, apierror.CodeAuthJWKSUnavailable)
}

func mustRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	return key
}

func newJWKSServer(t *testing.T, publicKey rsa.PublicKey) *httptest.Server {
	t.Helper()
	body, err := json.Marshal(jwksResponse{Keys: []jwk{rsaPublicJWK(publicKey)}})
	if err != nil {
		t.Fatalf("Marshal jwks: %v", err)
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
}

func rsaPublicJWK(publicKey rsa.PublicKey) jwk {
	return jwk{
		Kid: "test-key",
		Kty: "RSA",
		Alg: "RS256",
		Use: "sig",
		N:   base64.RawURLEncoding.EncodeToString(publicKey.N.Bytes()),
		E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(publicKey.E)).Bytes()),
	}
}

func signGoogleToken(t *testing.T, privateKey *rsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"
	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("SignedString: %v", err)
	}
	return signed
}

func assertAPIErrorCode(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var apiErr *apierror.ApiError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected ApiError, got %T (%v)", err, err)
	}
	if apiErr.Code != want {
		t.Fatalf("code = %s, want %s", apiErr.Code, want)
	}
}

func resetTestCache(t *testing.T, url string) {
	t.Helper()
	cacheMu.Lock()
	defer cacheMu.Unlock()
	jwksURL = url
	jwksCache = nil
	t.Cleanup(func() {
		cacheMu.Lock()
		defer cacheMu.Unlock()
		jwksURL = "https://www.googleapis.com/oauth2/v3/certs"
		jwksCache = nil
	})
}
