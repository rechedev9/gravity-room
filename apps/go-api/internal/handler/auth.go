package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/googleauth"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	mw "github.com/reche/gravity-room/apps/go-api/internal/middleware"
	"github.com/reche/gravity-room/apps/go-api/internal/model"
	"github.com/reche/gravity-room/apps/go-api/internal/service"
	"github.com/reche/gravity-room/apps/go-api/internal/telegram"
)

const (
	refreshCookieName = "refresh_token"
	refreshCookiePath = "/api/auth"
	refreshMaxAge     = 7 * 24 * 60 * 60 // 604800 seconds

	maxAvatarBytes = 200_000
)

var dataURLImageRe = regexp.MustCompile(`^data:image/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`)

// AuthHandler holds dependencies for auth routes.
type AuthHandler struct {
	Pool              *pgxpool.Pool
	JWTSecret         string
	AccessExpiry      time.Duration
	GoogleClientID    string
	TelegramBotToken  string
	TelegramChatID    string
	IsProd            bool
	HTTPClient        *http.Client
	VerifyGoogleToken func(context.Context, *http.Client, string, string) (googleauth.TokenPayload, error)
	SendTelegram      func(context.Context, *http.Client, string, string, string) error
}

type deviceType string

const (
	deviceMobile  deviceType = "Mobile"
	deviceDesktop deviceType = "Desktop"
	deviceBot     deviceType = "Bot"
	deviceUnknown deviceType = "Unknown"
)

// HandleDevLogin handles POST /api/auth/dev — dev-only user creation.
func (h *AuthHandler) HandleDevLogin(w http.ResponseWriter, r *http.Request) {
	if h.IsProd {
		apierror.New(404, "Not found", apierror.CodeNotFound).Write(w)
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		apierror.New(422, "email is required", apierror.CodeValidationError).Write(w)
		return
	}

	user, err := service.FindOrCreateDevUser(r.Context(), h.Pool, body.Email)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("dev login failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	accessToken, err := service.SignAccessToken(user.ID, user.Email, h.JWTSecret, h.AccessExpiry)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("sign access token failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	refreshToken, err := service.CreateRefreshToken(r.Context(), h.Pool, user.ID, nil)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("create refresh token failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	h.setRefreshCookie(w, refreshToken)

	resp := model.AuthResponse{
		User:        user,
		AccessToken: accessToken,
	}

	respondJSON(w, r, 201, resp)
}

// HandleGoogleLogin handles POST /api/auth/google.
func (h *AuthHandler) HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if rateLimit(w, "auth.google", mw.IP(r.Context())) {
		return
	}
	var body struct {
		Credential string `json:"credential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Credential == "" {
		apierror.New(400, "Validation failed", apierror.CodeValidationError).Write(w)
		return
	}

	payload, err := h.verifyGoogleToken(r.Context(), body.Credential)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			switch apiErr.Code {
			case apierror.CodeAccountDeleted, apierror.CodeDBWriteError, apierror.CodeAuthJWKSUnavailable, apierror.CodeConfigurationError, apierror.CodeAuthInvalid:
				if apiErr.Code == apierror.CodeAuthInvalid {
					apierror.New(401, "Invalid Google credential", apierror.CodeAuthGoogleInvalid).Write(w)
					return
				}
				apiErr.Write(w)
				return
			}
		}
		logging.FromContext(r.Context()).Warn("google token verification failed", "err", err)
		apierror.New(401, "Invalid Google credential", apierror.CodeAuthGoogleInvalid).Write(w)
		return
	}

	result, err := service.FindOrCreateGoogleUser(r.Context(), h.Pool, payload.Sub, payload.Email, payload.Name)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		logging.FromContext(r.Context()).Error("google login failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	accessToken, err := service.SignAccessToken(result.User.ID, result.User.Email, h.JWTSecret, h.AccessExpiry)
	if err != nil {
		logging.FromContext(r.Context()).Error("sign access token failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	refreshToken, err := service.CreateRefreshToken(r.Context(), h.Pool, result.User.ID, nil)
	if err != nil {
		logging.FromContext(r.Context()).Error("create refresh token failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	h.setRefreshCookie(w, refreshToken)
	if result.IsNewUser {
		h.notifyNewUser(r.Context(), payload.Email, classifyDevice(r.Header.Get("User-Agent")))
	}

	resp := model.AuthResponse{User: result.User, AccessToken: accessToken}
	respondJSON(w, r, 0, resp)
}

// HandleDeleteAccount handles DELETE /api/auth/me — soft-delete user account.
func (h *AuthHandler) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	if rateLimit(w, "auth.delete", mw.IP(r.Context())) {
		return
	}
	userID := mw.UserID(r.Context())

	err := service.SoftDeleteUser(r.Context(), h.Pool, userID)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("delete account failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	h.clearRefreshCookie(w)
	w.WriteHeader(204)
}

// HandleUpdateProfile handles PATCH /api/auth/me — update name and/or avatar.
func (h *AuthHandler) HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	if rateLimit(w, "auth.patch", mw.IP(r.Context())) {
		return
	}
	userID := mw.UserID(r.Context())

	// Use json.RawMessage to distinguish null from absent for avatarUrl.
	var raw struct {
		Name      *string         `json:"name"`
		AvatarURL json.RawMessage `json:"avatarUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		apierror.New(422, "Invalid request body", apierror.CodeValidationError).Write(w)
		return
	}

	// Validate name.
	if raw.Name != nil {
		if len(*raw.Name) < 1 || len(*raw.Name) > 100 {
			apierror.New(422, "name must be 1-100 characters", apierror.CodeValidationError).Write(w)
			return
		}
	}

	// Parse avatarUrl: absent vs null vs string value.
	var avatarPtr *string
	setAvatar := false
	if raw.AvatarURL != nil {
		setAvatar = true
		if string(raw.AvatarURL) == "null" {
			avatarPtr = nil // clear avatar
		} else {
			var avatarVal string
			if err := json.Unmarshal(raw.AvatarURL, &avatarVal); err != nil {
				apierror.New(400, "avatarUrl must be a string or null", apierror.CodeValidationError).Write(w)
				return
			}
			// Validate data URL format.
			if !dataURLImageRe.MatchString(avatarVal) {
				apierror.New(400, "Avatar must be a base64 data URL (JPEG, PNG, or WebP)", apierror.CodeInvalidAvatar).Write(w)
				return
			}
			// Size gate.
			if len(avatarVal) > maxAvatarBytes {
				apierror.New(400, "Avatar exceeds maximum size (200KB)", apierror.CodeAvatarTooLarge).Write(w)
				return
			}
			// Base64 roundtrip integrity.
			parts := strings.SplitN(avatarVal, ",", 2)
			if len(parts) != 2 || len(parts[1]) == 0 {
				apierror.New(400, "Empty avatar data", apierror.CodeInvalidAvatar).Write(w)
				return
			}
			decoded, err := base64.StdEncoding.DecodeString(parts[1])
			if err != nil {
				apierror.New(400, "Invalid base64 in avatar", apierror.CodeInvalidAvatar).Write(w)
				return
			}
			if base64.StdEncoding.EncodeToString(decoded) != parts[1] {
				apierror.New(400, "Invalid base64 in avatar", apierror.CodeInvalidAvatar).Write(w)
				return
			}
			avatarPtr = &avatarVal
		}
	}

	user, err := service.UpdateUserProfile(r.Context(), h.Pool, userID, raw.Name, avatarPtr, setAvatar)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		log := logging.FromContext(r.Context())
		log.Error("update profile failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, user)
}

// HandleMe handles GET /api/auth/me — returns the current user.
func (h *AuthHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	userID := mw.UserID(r.Context())
	if rateLimit(w, "auth.me", userID) {
		return
	}

	user, err := service.FindUserByID(r.Context(), h.Pool, userID)
	if err != nil {
		if apiErr, ok := err.(*apierror.ApiError); ok {
			apiErr.Write(w)
			return
		}
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	respondJSON(w, r, 0, user)
}

// HandleRefresh handles POST /api/auth/refresh — rotates refresh token.
func (h *AuthHandler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	if rateLimitDev(w, "auth.refresh", mw.IP(r.Context()), !h.IsProd) {
		return
	}
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		apierror.New(401, "No refresh token", apierror.CodeAuthNoRefreshToken).Write(w)
		return
	}

	newRawToken, userID, rotateErr := service.RotateRefreshToken(r.Context(), h.Pool, cookie.Value)
	if rotateErr != nil {
		h.clearRefreshCookie(w)
		msg := "Invalid refresh token"
		code := apierror.CodeAuthInvalidRefresh
		if strings.Contains(rotateErr.Error(), "expired") {
			msg = "Refresh token expired"
			code = apierror.CodeAuthRefreshExpired
		}
		apierror.New(401, msg, code).Write(w)
		return
	}

	accessToken, err := service.SignAccessToken(userID, "", h.JWTSecret, h.AccessExpiry)
	if err != nil {
		log := logging.FromContext(r.Context())
		log.Error("sign access token on refresh failed", "err", err)
		apierror.New(500, "Internal server error", apierror.CodeInternalError).Write(w)
		return
	}

	h.setRefreshCookie(w, newRawToken)

	resp := model.RefreshResponse{AccessToken: accessToken}
	respondJSON(w, r, 0, resp)
}

// HandleSignout handles POST /api/auth/signout — revokes refresh token.
func (h *AuthHandler) HandleSignout(w http.ResponseWriter, r *http.Request) {
	if rateLimit(w, "auth.signout", mw.IP(r.Context())) {
		return
	}
	cookie, err := r.Cookie(refreshCookieName)
	if err == nil && cookie.Value != "" {
		_ = service.RevokeToken(r.Context(), h.Pool, cookie.Value)
	}

	h.clearRefreshCookie(w)
	w.WriteHeader(204)
}

// setRefreshCookie sets the refresh_token cookie matching TS contract.
func (h *AuthHandler) setRefreshCookie(w http.ResponseWriter, rawToken string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    rawToken,
		Path:     refreshCookiePath,
		MaxAge:   refreshMaxAge,
		HttpOnly: true,
		Secure:   h.IsProd,
		SameSite: http.SameSiteStrictMode,
	})
}

// clearRefreshCookie clears the refresh_token cookie.
// Go's MaxAge=-1 emits "Max-Age=0" in the Set-Cookie header,
// which the harness cookie jar parses as maxAge: 0.
func (h *AuthHandler) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.IsProd,
		SameSite: http.SameSiteStrictMode,
	})
}

func classifyDevice(userAgent string) deviceType {
	if userAgent == "" {
		return deviceUnknown
	}
	if containsAny(strings.ToLower(userAgent), []string{"bot", "crawler", "spider"}) {
		return deviceBot
	}
	if containsAny(userAgent, []string{"Mobile", "Android", "iPhone", "iPad", "iPod"}) {
		return deviceMobile
	}
	return deviceDesktop
}

func containsAny(input string, terms []string) bool {
	for _, term := range terms {
		if strings.Contains(input, term) {
			return true
		}
	}
	return false
}

func (h *AuthHandler) notifyNewUser(ctx context.Context, email string, device deviceType) {
	text := fmt.Sprintf("New user: %s | %s | %s", email, device, time.Now().UTC().Format(time.RFC3339))
	go func() {
		if err := h.sendTelegram(context.Background(), text); err != nil {
			logging.FromContext(ctx).Warn("telegram: sendMessage failed", slog.Any("err", err))
		}
	}()
}

func (h *AuthHandler) httpClient() *http.Client {
	if h.HTTPClient != nil {
		return h.HTTPClient
	}
	return &http.Client{Timeout: 5 * time.Second}
}

func (h *AuthHandler) verifyGoogleToken(ctx context.Context, credential string) (googleauth.TokenPayload, error) {
	if h.VerifyGoogleToken != nil {
		return h.VerifyGoogleToken(ctx, h.httpClient(), credential, h.GoogleClientID)
	}
	return googleauth.VerifyToken(ctx, h.httpClient(), credential, h.GoogleClientID)
}

func (h *AuthHandler) sendTelegram(ctx context.Context, text string) error {
	if h.SendTelegram != nil {
		return h.SendTelegram(ctx, h.httpClient(), h.TelegramBotToken, h.TelegramChatID, text)
	}
	return telegram.SendMessage(ctx, h.httpClient(), h.TelegramBotToken, h.TelegramChatID, text)
}
