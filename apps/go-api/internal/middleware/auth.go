package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	goredis "github.com/redis/go-redis/v9"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	"github.com/reche/gravity-room/apps/go-api/internal/presence"
)

const keyUserID ctxKey = 10

var presenceRedis *goredis.Client

// SetPresenceRedis sets the Redis client used for presence tracking.
// Must be called before the server starts accepting traffic.
func SetPresenceRedis(rdb *goredis.Client) {
	presenceRedis = rdb
}

// UserID returns the authenticated user's ID from context.
// Returns empty string if not authenticated.
func UserID(ctx context.Context) string {
	if v, ok := ctx.Value(keyUserID).(string); ok {
		return v
	}
	return ""
}

// WithUserID injects a userID into the context. Intended for tests.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, keyUserID, userID)
}

// RequireAuth is a chi middleware that extracts and verifies a JWT Bearer token.
// On failure, returns 401. On success, injects userId into context.
func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := extractAndVerify(r, secret)
			if err != nil {
				apierror.New(401, "Unauthorized", apierror.CodeUnauthorized).Write(w)
				return
			}
			ctx := context.WithValue(r.Context(), keyUserID, userID)
			trackPresence(ctx, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth is like RequireAuth but does not 401 on failure.
// If the token is valid, userId is set in context; otherwise nil.
func OptionalAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := extractAndVerify(r, secret)
			if err == nil && userID != "" {
				ctx := context.WithValue(r.Context(), keyUserID, userID)
				trackPresence(ctx, userID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// extractAndVerify extracts the Bearer token from the Authorization header,
// verifies the HS256 JWT, and returns the sub claim.
func extractAndVerify(r *http.Request, secret string) (string, error) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return "", jwt.ErrTokenNotValidYet
	}

	rawToken, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || rawToken == "" {
		return "", jwt.ErrTokenNotValidYet
	}

	token, err := jwt.Parse(rawToken, func(_ *jwt.Token) (any, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return "", err
	}

	sub, err := token.Claims.GetSubject()
	if err != nil || sub == "" {
		return "", jwt.ErrTokenNotValidYet
	}

	return sub, nil
}

// trackPresence fires a background goroutine to mark the user as online.
// Matches TS auth-guard.ts: fire-and-forget with .catch() logging.
func trackPresence(ctx context.Context, userID string) {
	if presenceRedis == nil {
		return
	}
	go func() {
		if err := presence.Track(context.Background(), presenceRedis, userID); err != nil {
			logging.FromContext(ctx).Warn("presence track failed", "err", err)
		}
	}()
}
