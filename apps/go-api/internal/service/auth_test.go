package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestHashTokenParity(t *testing.T) {
	// SHA-256("test-token") in hex — must match TS hashToken("test-token").
	got := HashToken("test-token")
	want := "4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e"
	if got != want {
		t.Errorf("HashToken(\"test-token\")\n got  %s\n want %s", got, want)
	}
}

func TestHashTokenLength(t *testing.T) {
	hash := HashToken("any-value")
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64", len(hash))
	}
}

func TestHashTokenDeterministic(t *testing.T) {
	a := HashToken("same-input")
	b := HashToken("same-input")
	if a != b {
		t.Error("HashToken is not deterministic")
	}
}

func TestSignAccessTokenRoundtrip(t *testing.T) {
	secret := "test-secret-for-unit-tests-must-be-long-enough-64-chars-minimum!"
	userID := "550e8400-e29b-41d4-a716-446655440000"
	email := "test@example.com"

	token, err := SignAccessToken(userID, email, secret, 15*time.Minute)
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}
	if token == "" {
		t.Fatal("SignAccessToken returned empty token")
	}

	claims, err := parseJWTClaims(token, secret)
	if err != nil {
		t.Fatalf("parse JWT: %v", err)
	}

	if claims["sub"] != userID {
		t.Errorf("sub = %v, want %s", claims["sub"], userID)
	}
	if claims["email"] != email {
		t.Errorf("email = %v, want %s", claims["email"], email)
	}
	if _, ok := claims["exp"]; !ok {
		t.Error("exp claim missing")
	}
}

func TestSignAccessTokenNoEmail(t *testing.T) {
	secret := "test-secret-for-unit-tests-must-be-long-enough-64-chars-minimum!"
	userID := "550e8400-e29b-41d4-a716-446655440000"

	tokenStr, err := SignAccessToken(userID, "", secret, 15*time.Minute)
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}

	claims, err := parseJWTClaims(tokenStr, secret)
	if err != nil {
		t.Fatalf("parse JWT: %v", err)
	}

	if _, ok := claims["email"]; ok {
		t.Error("email claim should not be present when empty")
	}
}

func TestSignAccessTokenHS256(t *testing.T) {
	secret := "test-secret-for-unit-tests-must-be-long-enough-64-chars-minimum!"
	tokenStr, err := SignAccessToken("user-id", "", secret, 15*time.Minute)
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}

	// Parse without validation to check alg header.
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	tok, _, err := parser.ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		t.Fatalf("ParseUnverified: %v", err)
	}
	if tok.Method.Alg() != "HS256" {
		t.Errorf("alg = %s, want HS256", tok.Method.Alg())
	}
}

func TestParseAccessExpiry(t *testing.T) {
	tests := []struct {
		input string
		want  time.Duration
	}{
		{"15m", 15 * time.Minute},
		{"1h", time.Hour},
		{"30s", 30 * time.Second},
	}
	for _, tt := range tests {
		got, err := ParseAccessExpiry(tt.input)
		if err != nil {
			t.Errorf("ParseAccessExpiry(%q): %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("ParseAccessExpiry(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestParseAccessExpiryInvalid(t *testing.T) {
	_, err := ParseAccessExpiry("bad")
	if err == nil {
		t.Error("expected error for invalid expiry")
	}
}

// parseJWTClaims is a test helper that parses a JWT and returns claims.
func parseJWTClaims(tokenStr, secret string) (map[string]any, error) {
	tok, err := jwt.Parse(tokenStr, func(_ *jwt.Token) (any, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, err
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("unexpected claims type")
	}
	return claims, nil
}
