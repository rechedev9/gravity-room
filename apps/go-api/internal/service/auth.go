package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
)

const refreshTokenDays = 7

// HashToken computes SHA-256 of the raw token and returns hex-encoded string.
// Must produce identical output to the TS hashToken() function.
func HashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// SignAccessToken creates an HS256 JWT with sub, email, and exp claims.
func SignAccessToken(userID, email, secret string, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": now.Add(expiry).Unix(),
		"iat": now.Unix(),
	}
	if email != "" {
		claims["email"] = email
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseAccessExpiry parses a duration string like "15m", "1h", "30s".
func ParseAccessExpiry(s string) (time.Duration, error) {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid JWT_ACCESS_EXPIRY %q: %w", s, err)
	}
	return d, nil
}

// FindOrCreateDevUser finds or creates a user by email for dev login.
// google_id is set to "dev-<uuid>" for dev users.
func FindOrCreateDevUser(ctx context.Context, pool *pgxpool.Pool, email string) (model.UserResponse, error) {
	var user model.UserResponse
	googleID := "dev-" + uuid.New().String()

	err := pool.QueryRow(ctx, `
		INSERT INTO users (email, google_id)
		VALUES ($1, $2)
		ON CONFLICT (email)
		DO UPDATE SET email = users.email
		RETURNING id, email, name, avatar_url
	`, email, googleID).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL)

	if err != nil {
		return user, fmt.Errorf("find or create dev user: %w", err)
	}
	return user, nil
}

type FindOrCreateResult struct {
	User      model.UserResponse
	IsNewUser bool
}

// FindOrCreateGoogleUser upserts a user by google_id and returns the user plus new-user heuristic.
func FindOrCreateGoogleUser(ctx context.Context, pool *pgxpool.Pool, googleID, email string, name *string) (FindOrCreateResult, error) {
	var (
		user      model.UserResponse
		deletedAt *time.Time
		createdAt time.Time
		updatedAt time.Time
	)

	err := pool.QueryRow(ctx, `
		INSERT INTO users (google_id, email, name)
		VALUES ($1, $2, $3)
		ON CONFLICT (google_id)
		DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			updated_at = NOW()
		RETURNING id, email, name, avatar_url, deleted_at, created_at, updated_at
	`, googleID, strings.ToLower(email), name).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.AvatarURL,
		&deletedAt,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return FindOrCreateResult{}, apierror.New(500, "Failed to upsert user", apierror.CodeDBWriteError)
	}
	if deletedAt != nil {
		return FindOrCreateResult{}, apierror.New(403, "Esta cuenta ha sido eliminada. Contacta con soporte si deseas recuperarla.", apierror.CodeAccountDeleted)
	}

	return FindOrCreateResult{
		User:      user,
		IsNewUser: createdAt.Sub(updatedAt) < 2*time.Second && updatedAt.Sub(createdAt) < 2*time.Second,
	}, nil
}

// FindUserByID fetches a user by ID, filtering out soft-deleted users.
func FindUserByID(ctx context.Context, pool *pgxpool.Pool, userID string) (model.UserResponse, error) {
	var user model.UserResponse
	err := pool.QueryRow(ctx, `
		SELECT id, email, name, avatar_url
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user, apierror.New(404, "User not found", apierror.CodeUserNotFound)
		}
		return user, fmt.Errorf("find user by id: %w", err)
	}
	return user, nil
}

// CreateRefreshToken generates a new refresh token, hashes it, stores it in DB,
// and returns the raw token (for cookie). prevHash links to the predecessor.
func CreateRefreshToken(ctx context.Context, pool *pgxpool.Pool, userID string, prevHash *string) (string, error) {
	raw := uuid.New().String()
	hash := HashToken(raw)
	expiresAt := time.Now().Add(refreshTokenDays * 24 * time.Hour)

	_, err := pool.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, previous_token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`, userID, hash, prevHash, expiresAt)

	if err != nil {
		return "", fmt.Errorf("create refresh token: %w", err)
	}
	return raw, nil
}

// refreshTokenRow holds a row from the refresh_tokens table.
type refreshTokenRow struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
}

// RotateRefreshToken validates the current token (by hash), revokes it,
// creates a new one linked via previousTokenHash, and returns the new raw token + userID.
// If the token is not found, checks for reuse (theft detection).
func RotateRefreshToken(ctx context.Context, pool *pgxpool.Pool, rawToken string) (newRawToken string, userID string, err error) {
	hash := HashToken(rawToken)

	// Look up the token.
	var row refreshTokenRow
	lookupErr := pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, hash).Scan(&row.ID, &row.UserID, &row.TokenHash, &row.ExpiresAt)

	if lookupErr != nil {
		if lookupErr == pgx.ErrNoRows {
			// Token not found — check for reuse (token was already rotated).
			var successorUserID string
			reuseErr := pool.QueryRow(ctx, `
				SELECT user_id FROM refresh_tokens WHERE previous_token_hash = $1
			`, hash).Scan(&successorUserID)
			if reuseErr == nil {
				// Token reuse detected — revoke all user tokens.
				_, _ = pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, successorUserID)
			}
			return "", "", fmt.Errorf("invalid refresh token")
		}
		return "", "", fmt.Errorf("lookup refresh token: %w", lookupErr)
	}

	// Check expiry.
	if time.Now().After(row.ExpiresAt) {
		_, _ = pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash = $1`, hash)
		return "", "", fmt.Errorf("refresh token expired")
	}

	// Revoke the old token.
	_, _ = pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash = $1`, hash)

	// Create new token linked to old one.
	newRaw, createErr := CreateRefreshToken(ctx, pool, row.UserID, &hash)
	if createErr != nil {
		return "", "", createErr
	}

	return newRaw, row.UserID, nil
}

// RevokeToken deletes a single refresh token by its raw value.
func RevokeToken(ctx context.Context, pool *pgxpool.Pool, rawToken string) error {
	hash := HashToken(rawToken)
	_, err := pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash = $1`, hash)
	return err
}

// RevokeAllUserTokens deletes all refresh tokens for a user.
func RevokeAllUserTokens(ctx context.Context, pool *pgxpool.Pool, userID string) error {
	_, err := pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

// UpdateUserProfile partially updates a user's name and/or avatarUrl.
// Only fields that are explicitly provided (non-nil) are updated.
// avatarUrl accepts a *string where nil means "don't change" — pass a pointer to empty string
// or null-valued *string to clear it. The caller uses a separate flag to distinguish.
func UpdateUserProfile(ctx context.Context, pool *pgxpool.Pool, userID string, name *string, avatarUrl *string, setAvatar bool) (model.UserResponse, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1

	if name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *name)
		argIdx++
	}
	if setAvatar {
		setClauses = append(setClauses, fmt.Sprintf("avatar_url = $%d", argIdx))
		args = append(args, avatarUrl) // can be nil => SQL NULL
		argIdx++
	}

	args = append(args, userID)

	query := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, email, name, avatar_url
	`, strings.Join(setClauses, ", "), argIdx)

	var user model.UserResponse
	err := pool.QueryRow(ctx, query, args...).Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user, apierror.New(404, "User not found", apierror.CodeUserNotFound)
		}
		return user, fmt.Errorf("update user profile: %w", err)
	}
	return user, nil
}

// SoftDeleteUser sets deleted_at on the user and revokes all refresh tokens.
func SoftDeleteUser(ctx context.Context, pool *pgxpool.Pool, userID string) error {
	tag, err := pool.Exec(ctx, `
		UPDATE users SET deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID)
	if err != nil {
		return fmt.Errorf("soft delete user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierror.New(404, "User not found", apierror.CodeUserNotFound)
	}

	return RevokeAllUserTokens(ctx, pool, userID)
}

// CleanExpiredTokens deletes all refresh tokens that have passed their expiry.
func CleanExpiredTokens(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	tag, err := pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE expires_at < NOW()`)
	if err != nil {
		return 0, fmt.Errorf("clean expired tokens: %w", err)
	}
	return tag.RowsAffected(), nil
}
