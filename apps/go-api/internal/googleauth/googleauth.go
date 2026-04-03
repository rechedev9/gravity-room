package googleauth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
)

var jwksURL = "https://www.googleapis.com/oauth2/v3/certs"

var googleIssuers = []string{"accounts.google.com", "https://accounts.google.com"}

const cacheTTL = time.Hour

type TokenPayload struct {
	Sub   string
	Email string
	Name  *string
}

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
	Alg string `json:"alg"`
	Use string `json:"use"`
}

type header struct {
	Kid string `json:"kid"`
	Alg string `json:"alg"`
}

type claims struct {
	Sub   string          `json:"sub"`
	Email string          `json:"email"`
	Name  *string         `json:"name"`
	Aud   json.RawMessage `json:"aud"`
	Iss   string          `json:"iss"`
	Exp   int64           `json:"exp"`
}

type jwksResponse struct {
	Keys []jwk `json:"keys"`
}

type cacheEntry struct {
	Keys      []jwk
	FetchedAt time.Time
}

var (
	cacheMu    sync.Mutex
	jwksCache  *cacheEntry
	fetchGroup singleflight.Group
)

func VerifyToken(ctx context.Context, client *http.Client, credential, clientID string) (TokenPayload, error) {
	if clientID == "" {
		return TokenPayload{}, apierror.New(500, "GOOGLE_CLIENT_ID env var must be set", apierror.CodeConfigurationError)
	}

	parts := splitJWT(credential)
	if len(parts) != 3 {
		return TokenPayload{}, apierror.New(401, "Invalid JWT format: expected 3 segments", apierror.CodeAuthInvalid)
	}

	var tokenHeader header
	if err := decodeJWTPart(parts[0], &tokenHeader); err != nil || tokenHeader.Kid == "" || tokenHeader.Alg == "" {
		return TokenPayload{}, apierror.New(401, "Invalid JWT header", apierror.CodeAuthInvalid)
	}
	if tokenHeader.Alg != "RS256" {
		return TokenPayload{}, apierror.New(401, "Unsupported token algorithm", apierror.CodeAuthInvalid)
	}

	keys, err := fetchGoogleCerts(ctx, client)
	if err != nil {
		return TokenPayload{}, err
	}

	var signingKey *jwk
	for i := range keys {
		if keys[i].Kid == tokenHeader.Kid {
			signingKey = &keys[i]
			break
		}
	}
	if signingKey == nil {
		return TokenPayload{}, apierror.New(401, "Unknown token signing key", apierror.CodeAuthInvalid)
	}

	publicKey, err := jwkToPublicKey(*signingKey)
	if err != nil {
		return TokenPayload{}, apierror.New(503, "Invalid JWKS response format", apierror.CodeAuthJWKSUnavailable)
	}

	signingInput := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return TokenPayload{}, apierror.New(401, "Invalid JWT signature", apierror.CodeAuthInvalid)
	}

	digest := sha256.Sum256([]byte(signingInput))
	if err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], signature); err != nil {
		return TokenPayload{}, apierror.New(401, "Invalid JWT signature", apierror.CodeAuthInvalid)
	}

	var tokenClaims claims
	if err := decodeJWTPart(parts[1], &tokenClaims); err != nil || tokenClaims.Sub == "" || tokenClaims.Email == "" || tokenClaims.Iss == "" || tokenClaims.Exp == 0 {
		return TokenPayload{}, apierror.New(401, "Invalid JWT payload", apierror.CodeAuthInvalid)
	}

	if time.Now().Unix() > tokenClaims.Exp {
		return TokenPayload{}, apierror.New(401, "Token has expired", apierror.CodeAuthInvalid)
	}
	if !slices.Contains(googleIssuers, tokenClaims.Iss) {
		return TokenPayload{}, apierror.New(401, "Invalid token issuer", apierror.CodeAuthInvalid)
	}

	audiences, err := parseAudiences(tokenClaims.Aud)
	if err != nil {
		return TokenPayload{}, apierror.New(401, "Invalid audience", apierror.CodeAuthInvalid)
	}
	if !slices.Contains(audiences, clientID) {
		return TokenPayload{}, apierror.New(401, "Invalid audience", apierror.CodeAuthInvalid)
	}

	return TokenPayload{
		Sub:   tokenClaims.Sub,
		Email: tokenClaims.Email,
		Name:  tokenClaims.Name,
	}, nil
}

func fetchGoogleCerts(ctx context.Context, client *http.Client) ([]jwk, error) {
	cacheMu.Lock()
	if jwksCache != nil && time.Since(jwksCache.FetchedAt) < cacheTTL {
		keys := append([]jwk(nil), jwksCache.Keys...)
		cacheMu.Unlock()
		return keys, nil
	}
	cacheMu.Unlock()

	// singleflight deduplicates concurrent cache misses: only one goroutine
	// performs the HTTP fetch while others wait and share the result.
	v, err, _ := fetchGroup.Do("jwks", func() (any, error) {
		// Re-check inside singleflight: a prior waiter may have just populated
		// the cache by the time we get the lock.
		cacheMu.Lock()
		if jwksCache != nil && time.Since(jwksCache.FetchedAt) < cacheTTL {
			keys := append([]jwk(nil), jwksCache.Keys...)
			cacheMu.Unlock()
			return keys, nil
		}
		cacheMu.Unlock()

		if client == nil {
			client = &http.Client{Timeout: 5 * time.Second}
		}

		requestCtx := ctx
		if _, hasDeadline := ctx.Deadline(); !hasDeadline {
			var cancel context.CancelFunc
			requestCtx, cancel = context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
		}

		req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, jwksURL, nil)
		if err != nil {
			return nil, fmt.Errorf("create jwks request: %w", err)
		}

		resp, err := client.Do(req)
		if err != nil {
			return nil, apierror.New(503, "Google JWKS endpoint unavailable", apierror.CodeAuthJWKSUnavailable)
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			return nil, apierror.New(503, "Google JWKS endpoint unavailable", apierror.CodeAuthJWKSUnavailable)
		}

		var payload jwksResponse
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil || len(payload.Keys) == 0 {
			return nil, apierror.New(503, "Invalid JWKS response format", apierror.CodeAuthJWKSUnavailable)
		}

		cacheMu.Lock()
		jwksCache = &cacheEntry{Keys: append([]jwk(nil), payload.Keys...), FetchedAt: time.Now()}
		cacheMu.Unlock()

		return append([]jwk(nil), payload.Keys...), nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]jwk), nil //nolint:forcetypeassert
}

func decodeJWTPart(raw string, out any) error {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(decoded, out)
}

func jwkToPublicKey(key jwk) (*rsa.PublicKey, error) {
	if key.Kty != "RSA" || key.N == "" || key.E == "" {
		return nil, fmt.Errorf("invalid jwk")
	}

	modulusBytes, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, fmt.Errorf("decode modulus: %w", err)
	}
	exponentBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, fmt.Errorf("decode exponent: %w", err)
	}

	modulus := new(big.Int).SetBytes(modulusBytes)
	exponent := new(big.Int).SetBytes(exponentBytes)
	if !exponent.IsInt64() {
		return nil, fmt.Errorf("exponent too large")
	}

	return &rsa.PublicKey{N: modulus, E: int(exponent.Int64())}, nil
}

func parseAudiences(raw json.RawMessage) ([]string, error) {
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return []string{single}, nil
	}

	var multiple []string
	if err := json.Unmarshal(raw, &multiple); err == nil {
		return multiple, nil
	}

	return nil, fmt.Errorf("invalid aud claim")
}

func splitJWT(token string) []string {
	parts := make([]string, 0, 3)
	start := 0
	for i := range token {
		if token[i] == '.' {
			parts = append(parts, token[start:i])
			start = i + 1
		}
	}
	parts = append(parts, token[start:])
	return parts
}
