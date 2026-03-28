package middleware

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/logging"
	m "github.com/reche/gravity-room/apps/go-api/internal/metrics"
	"github.com/reche/gravity-room/apps/go-api/internal/sentry"
)

// Recovery catches panics and ApiErrors, writing the contract-mandated JSON response.
// Matches TS create-app.ts onError handler behavior:
//   - ApiError: use its StatusCode/Code, copy extra headers, log warn (<500) or error (>=500)
//   - Panic with ApiError: same as above
//   - Panic with other value: 500 INTERNAL_ERROR
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rv := recover(); rv != nil {
				log := logging.FromContext(r.Context())
				var apiErr *apierror.ApiError
				switch v := rv.(type) {
				case *apierror.ApiError:
					apiErr = v
				case error:
					if errors.As(v, &apiErr) {
						// unwrapped ApiError
					} else {
						log.Error("unhandled panic", "err", v)
						apiErr = apierror.New(500, "Internal server error", apierror.CodeInternalError)
					}
				default:
					log.Error("unhandled panic", "err", rv)
					apiErr = apierror.New(500, "Internal server error", apierror.CodeInternalError)
				}
				writeAPIError(w, r, apiErr, log)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// ErrorHandler is a helper for handlers that return *ApiError.
// It writes the error response and records metrics.
func ErrorHandler(w http.ResponseWriter, r *http.Request, err *apierror.ApiError) {
	log := logging.FromContext(r.Context())
	writeAPIError(w, r, err, log)
}

func writeAPIError(w http.ResponseWriter, r *http.Request, err *apierror.ApiError, log *slog.Logger) {
	if err.StatusCode >= 500 {
		log.Error(err.Message, "status", err.StatusCode, "code", err.Code)
		sentry.CaptureException(err)
	} else {
		log.Warn(err.Message, "status", err.StatusCode, "code", err.Code)
	}
	// Record error metrics (matches TS onError hook in plugins/metrics.ts).
	m.HTTPErrorsTotal.WithLabelValues(m.StatusClass(err.StatusCode), err.Code).Inc()
	m.HTTPRequestsTotal.WithLabelValues(r.Method, m.NormaliseRoute(r.URL.Path), m.StatusStr(err.StatusCode)).Inc()

	err.Write(w)
}
