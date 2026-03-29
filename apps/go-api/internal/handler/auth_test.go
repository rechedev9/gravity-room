package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/googleauth"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func TestClassifyDevice(t *testing.T) {
	tests := []struct {
		name      string
		userAgent string
		want      deviceType
	}{
		{name: "missing", userAgent: "", want: deviceUnknown},
		{name: "bot", userAgent: "ExampleBot/1.0", want: deviceBot},
		{name: "mobile", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", want: deviceMobile},
		{name: "desktop", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", want: deviceDesktop},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyDevice(tt.userAgent); got != tt.want {
				t.Fatalf("classifyDevice(%q) = %q, want %q", tt.userAgent, got, tt.want)
			}
		})
	}
}

func TestHandleGoogleLoginValidationError(t *testing.T) {
	h := &AuthHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleGoogleLogin(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeValidationError {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeValidationError)
	}
}

func TestHandleGoogleLoginMapsAuthInvalid(t *testing.T) {
	h := &AuthHandler{
		GoogleClientID: "test-client-id",
		VerifyGoogleToken: func(context.Context, *http.Client, string, string) (googleauth.TokenPayload, error) {
			return googleauth.TokenPayload{}, apierror.New(401, "Invalid audience", apierror.CodeAuthInvalid)
		},
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{"credential":"bad"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleGoogleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != apierror.CodeAuthGoogleInvalid {
		t.Fatalf("code = %s, want %s", body.Code, apierror.CodeAuthGoogleInvalid)
	}
}

func TestNotifyNewUserUsesExpectedMessage(t *testing.T) {
	messageCh := make(chan string, 1)
	h := &AuthHandler{
		SendTelegram: func(_ context.Context, _ *http.Client, _, _, text string) error {
			messageCh <- text
			return nil
		},
	}

	ctx := logging.WithContext(context.Background(), logging.NewTestLogger())
	h.notifyNewUser(ctx, "user@example.com", deviceMobile)

	select {
	case msg := <-messageCh:
		if !strings.Contains(msg, "New user: user@example.com | Mobile | ") {
			t.Fatalf("unexpected message: %q", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("telegram notification not sent")
	}
}

func TestSendTelegramUsesOverride(t *testing.T) {
	called := false
	h := &AuthHandler{
		SendTelegram: func(_ context.Context, _ *http.Client, _, _, _ string) error {
			called = true
			return nil
		},
	}

	if err := h.sendTelegram(context.Background(), "hello"); err != nil {
		t.Fatalf("sendTelegram: %v", err)
	}
	if !called {
		t.Fatal("expected override to be called")
	}
}

func TestVerifyGoogleTokenUsesOverride(t *testing.T) {
	h := &AuthHandler{
		GoogleClientID: "test-client-id",
		VerifyGoogleToken: func(_ context.Context, _ *http.Client, credential, clientID string) (googleauth.TokenPayload, error) {
			if credential != "credential" {
				t.Fatalf("credential = %q, want credential", credential)
			}
			if clientID != "test-client-id" {
				t.Fatalf("clientID = %q, want test-client-id", clientID)
			}
			return googleauth.TokenPayload{Sub: "sub", Email: "user@example.com"}, nil
		},
	}

	payload, err := h.verifyGoogleToken(context.Background(), "credential")
	if err != nil {
		t.Fatalf("verifyGoogleToken: %v", err)
	}
	if payload.Sub != "sub" {
		t.Fatalf("sub = %q, want sub", payload.Sub)
	}
}
