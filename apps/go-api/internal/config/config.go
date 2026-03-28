package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Config holds all environment-derived configuration.
// Field names and defaults match the TS API contract (http-contract.md §1).
type Config struct {
	Port     int
	Env      string // "development", "test", "production"
	LogLevel string

	DatabaseURL string
	DBPoolSize  int
	DBSSL       bool

	JWTSecret       string
	JWTAccessExpiry string
	GoogleClientID  string

	CORSOrigins []string

	RedisURL     string
	SentryDSN    string
	TrustedProxy bool
	MetricsToken string

	AdminUserIDs []string

	TelegramBotToken string
	TelegramChatID   string
}

// IsProd returns true when running in production.
func (c *Config) IsProd() bool { return c.Env == "production" }

// Load reads environment variables and validates required constraints.
// It mirrors the TS bootstrap.ts validation rules exactly.
func Load() (*Config, error) {
	env := envOr("NODE_ENV", "development")

	c := &Config{
		Env:              env,
		LogLevel:         envOr("LOG_LEVEL", "info"),
		JWTAccessExpiry:  envOr("JWT_ACCESS_EXPIRY", "15m"),
		GoogleClientID:   os.Getenv("GOOGLE_CLIENT_ID"),
		RedisURL:         os.Getenv("REDIS_URL"),
		SentryDSN:        os.Getenv("SENTRY_DSN"),
		MetricsToken:     os.Getenv("METRICS_TOKEN"),
		TelegramBotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramChatID:   os.Getenv("TELEGRAM_CHAT_ID"),
	}

	// PORT — default 3001
	port, err := envInt("PORT", 3001)
	if err != nil {
		return nil, err
	}
	c.Port = port

	// DB_POOL_SIZE — default 50
	poolSize, err := envInt("DB_POOL_SIZE", 50)
	if err != nil {
		return nil, err
	}
	c.DBPoolSize = poolSize

	// DB_SSL — default true in prod, false in dev
	c.DBSSL = envBool("DB_SSL", c.IsProd())

	// TRUSTED_PROXY
	c.TrustedProxy = envBool("TRUSTED_PROXY", false)

	// DATABASE_URL — required
	c.DatabaseURL = os.Getenv("DATABASE_URL")
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	// JWT_SECRET — required in prod, 64+ chars, must not be dev default
	c.JWTSecret = envOr("JWT_SECRET", "dev-secret-change-me")
	if c.IsProd() {
		if c.JWTSecret == "" {
			return nil, fmt.Errorf("JWT_SECRET must be set in production")
		}
		if c.JWTSecret == "dev-secret-change-me" {
			return nil, fmt.Errorf("JWT_SECRET must not use the dev default in production")
		}
		if len(c.JWTSecret) < 64 {
			return nil, fmt.Errorf("JWT_SECRET must be at least 64 characters in production")
		}
	}

	// CORS_ORIGIN — required in prod, default localhost:3000 in dev
	origins, err := parseCORSOrigins(os.Getenv("CORS_ORIGIN"), c.IsProd())
	if err != nil {
		return nil, err
	}
	c.CORSOrigins = origins

	// ADMIN_USER_IDS — comma-separated UUIDs
	if raw := os.Getenv("ADMIN_USER_IDS"); raw != "" {
		for _, id := range strings.Split(raw, ",") {
			if trimmed := strings.TrimSpace(id); trimmed != "" {
				c.AdminUserIDs = append(c.AdminUserIDs, trimmed)
			}
		}
	}

	return c, nil
}

func parseCORSOrigins(raw string, isProd bool) ([]string, error) {
	if raw == "" {
		if isProd {
			return nil, fmt.Errorf("CORS_ORIGIN env var must be set in production")
		}
		return []string{"http://localhost:3000"}, nil
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, s := range parts {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, err := url.ParseRequestURI(s); err != nil {
			return nil, fmt.Errorf("CORS_ORIGIN contains invalid URL: %q", s)
		}
		origins = append(origins, s)
	}
	if len(origins) == 0 {
		if isProd {
			return nil, fmt.Errorf("CORS_ORIGIN env var must be set in production")
		}
		return []string{"http://localhost:3000"}, nil
	}
	return origins, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return v, nil
}

func envBool(key string, fallback bool) bool {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return v
}
