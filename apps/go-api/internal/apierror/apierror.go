package apierror

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

// ApiError is the canonical error type for all API responses.
// Mirrors the TS ApiError class (error-handler.ts).
type ApiError struct {
	StatusCode int               `json:"-"`
	Message    string            `json:"error"`
	Code       string            `json:"code"`
	Headers    map[string]string `json:"-"`
}

func (e *ApiError) Error() string {
	return fmt.Sprintf("[%d] %s (%s)", e.StatusCode, e.Message, e.Code)
}

// New creates an ApiError.
func New(statusCode int, message, code string) *ApiError {
	return &ApiError{StatusCode: statusCode, Message: message, Code: code}
}

// WithHeaders returns a copy with response headers attached (e.g. Retry-After).
func (e *ApiError) WithHeaders(h map[string]string) *ApiError {
	cp := *e
	cp.Headers = h
	return &cp
}

// Write sends the error as a JSON response, copying any extra headers.
// Matches TS contract: {"error": "...", "code": "..."}
func (e *ApiError) Write(w http.ResponseWriter) {
	for k, v := range e.Headers {
		w.Header().Set(k, v)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.StatusCode)
	if err := json.NewEncoder(w).Encode(e); err != nil {
		slog.Warn("apierror json encode failed", "err", err)
	}
}

// WriteJSON is a convenience for sending arbitrary JSON error responses.
func WriteJSON(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]string{
		"error": message,
		"code":  code,
	}); err != nil {
		slog.Warn("apierror json encode failed", "err", err)
	}
}

// Domain error codes — mirrors the TS ApiErrorCode constants from error-handler.ts
// and the full error code inventory from http-contract.md §5.
const (
	CodeUnauthorized         = "UNAUTHORIZED"
	CodeAuthInvalid          = "AUTH_INVALID"
	CodeAuthJWKSUnavailable  = "AUTH_JWKS_UNAVAILABLE"
	CodeAuthGoogleInvalid    = "AUTH_GOOGLE_INVALID"
	CodeAuthNoRefreshToken   = "AUTH_NO_REFRESH_TOKEN"
	CodeAuthInvalidRefresh   = "AUTH_INVALID_REFRESH"
	CodeAuthRefreshExpired   = "AUTH_REFRESH_EXPIRED"
	CodeTokenInvalid         = "TOKEN_INVALID"
	CodeUserNotFound         = "USER_NOT_FOUND"
	CodeAccountDeleted       = "ACCOUNT_DELETED"
	CodeDBWriteError         = "DB_WRITE_ERROR"
	CodeConfigurationError   = "CONFIGURATION_ERROR"
	CodeNotFound             = "NOT_FOUND"
	CodeForbidden            = "FORBIDDEN"
	CodeValidationError      = "VALIDATION_ERROR"
	CodeParseError           = "PARSE_ERROR"
	CodeInternalError        = "INTERNAL_ERROR"
	CodeRateLimited          = "RATE_LIMITED"
	CodeGatewayTimeout       = "GATEWAY_TIMEOUT"
	CodeLimitExceeded        = "LIMIT_EXCEEDED"
	CodeInvalidTransition    = "INVALID_TRANSITION"
	CodeActiveInstancesExist = "ACTIVE_INSTANCES_EXIST"
	CodeHydrationFailed      = "HYDRATION_FAILED"
	CodeMetadataTooLarge     = "METADATA_TOO_LARGE"
	CodeInvalidAvatar        = "INVALID_AVATAR"
	CodeAvatarTooLarge       = "AVATAR_TOO_LARGE"
	CodeAmbiguousSource      = "AMBIGUOUS_SOURCE"
	CodeMissingProgramSource = "MISSING_PROGRAM_SOURCE"
	CodeInvalidProgram       = "INVALID_PROGRAM"
	CodeInvalidCursor        = "INVALID_CURSOR"
	CodeInstanceNotFound     = "INSTANCE_NOT_FOUND"
	CodeResultNotFound       = "RESULT_NOT_FOUND"
	CodeProgramNotFound      = "PROGRAM_NOT_FOUND"
	CodeInvalidData          = "INVALID_DATA"
	CodeInvalidSlug          = "INVALID_SLUG"
	CodeDuplicate            = "DUPLICATE"
	CodeCreateFailed         = "CREATE_FAILED"
	CodeImportFailed         = "IMPORT_FAILED"
	CodeDefinitionInvalid    = "DEFINITION_INVALID"
	CodeInsertFailed         = "INSERT_FAILED"
)
