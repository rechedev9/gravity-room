package middleware

import "net/http"

// SecurityConfig holds the header values injected at startup.
type SecurityConfig struct {
	CSP               string
	PermissionsPolicy string
	IsProd            bool
}

// SecurityHeaders sets the contract-mandated response headers on every request.
// Matches http-contract.md §3 and create-app.ts:49-57.
func SecurityHeaders(cfg SecurityConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("x-content-type-options", "nosniff")
			h.Set("x-frame-options", "DENY")
			h.Set("referrer-policy", "strict-origin-when-cross-origin")
			h.Set("content-security-policy", cfg.CSP)
			h.Set("permissions-policy", cfg.PermissionsPolicy)
			if cfg.IsProd {
				h.Set("strict-transport-security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}
