package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
)

func TestHandleDevLoginProdReturns404(t *testing.T) {
	h := &AuthHandler{IsProd: true}
	req := newReq(http.MethodPost, "/api/auth/dev", `{"email":"test@test.com"}`)
	rec := httptest.NewRecorder()

	h.HandleDevLogin(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestHandleDevLoginValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing email", body: `{}`},
		{name: "invalid JSON", body: `not json`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &AuthHandler{IsProd: false}
			req := newReq(http.MethodPost, "/api/auth/dev", tt.body)
			rec := httptest.NewRecorder()

			h.HandleDevLogin(rec, req)

			assertStatus(t, rec, http.StatusUnprocessableEntity)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}

func TestHandleRefreshMissingCookie(t *testing.T) {
	h := &AuthHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleRefresh(rec, req)

	assertStatus(t, rec, http.StatusUnauthorized)
	assertCode(t, rec, apierror.CodeAuthNoRefreshToken)
}

func TestHandleRefreshEmptyCookie(t *testing.T) {
	h := &AuthHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: ""})
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleRefresh(rec, req)

	assertStatus(t, rec, http.StatusUnauthorized)
	assertCode(t, rec, apierror.CodeAuthNoRefreshToken)
}

func TestHandleSignoutWithoutCookie(t *testing.T) {
	h := &AuthHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/signout", nil)
	req = req.WithContext(logging.WithContext(req.Context(), logging.NewTestLogger()))
	rec := httptest.NewRecorder()

	h.HandleSignout(rec, req)

	assertStatus(t, rec, http.StatusNoContent)
}

func TestHandleUpdateProfileValidation(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{name: "invalid JSON", body: `not json`, wantStatus: http.StatusUnprocessableEntity, wantCode: apierror.CodeValidationError},
		{name: "name too long", body: `{"name":"` + strings.Repeat("x", 101) + `"}`, wantStatus: http.StatusUnprocessableEntity, wantCode: apierror.CodeValidationError},
		{name: "empty name", body: `{"name":""}`, wantStatus: http.StatusUnprocessableEntity, wantCode: apierror.CodeValidationError},
		{name: "avatar not string", body: `{"avatarUrl":42}`, wantStatus: http.StatusBadRequest, wantCode: apierror.CodeValidationError},
		{name: "avatar invalid format", body: `{"avatarUrl":"https://example.com/img.png"}`, wantStatus: http.StatusBadRequest, wantCode: apierror.CodeInvalidAvatar},
		{name: "avatar too large", body: `{"avatarUrl":"data:image/png;base64,` + strings.Repeat("A", maxAvatarBytes+100) + `"}`, wantStatus: http.StatusBadRequest, wantCode: apierror.CodeAvatarTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &AuthHandler{}
			req := newReq(http.MethodPatch, "/api/auth/me", tt.body)
			rec := httptest.NewRecorder()

			h.HandleUpdateProfile(rec, req)

			assertStatus(t, rec, tt.wantStatus)
			assertCode(t, rec, tt.wantCode)
		})
	}
}

func TestHandleGoogleLoginValidation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "empty credential", body: `{"credential":""}`},
		{name: "invalid JSON", body: `not json`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &AuthHandler{}
			req := newReq(http.MethodPost, "/api/auth/google", tt.body)
			rec := httptest.NewRecorder()

			h.HandleGoogleLogin(rec, req)

			assertStatus(t, rec, http.StatusBadRequest)
			assertCode(t, rec, apierror.CodeValidationError)
		})
	}
}
