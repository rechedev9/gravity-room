package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

// CORS returns a chi middleware that reproduces the TS CORS behavior.
// Contract (http-contract.md §2):
//   - Access-Control-Allow-Credentials: true
//   - Allowed origins from config
//   - Mirror Access-Control-Request-Headers (AllowedHeaders: ["*"])
//   - All standard methods allowed
func CORS(origins []string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"}, // mirrors the request's Access-Control-Request-Headers
		AllowCredentials: true,
		MaxAge:           300,
	})
}
