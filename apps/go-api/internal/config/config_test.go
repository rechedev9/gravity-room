package config

import (
	"os"
	"testing"
)

func setEnv(t *testing.T, key, val string) {
	t.Helper()
	t.Setenv(key, val)
}

func TestLoad_Defaults(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")

	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != 3001 {
		t.Errorf("Port = %d, want 3001", c.Port)
	}
	if c.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want info", c.LogLevel)
	}
	if c.DBPoolSize != 50 {
		t.Errorf("DBPoolSize = %d, want 50", c.DBPoolSize)
	}
	if len(c.CORSOrigins) != 1 || c.CORSOrigins[0] != "http://localhost:3000" {
		t.Errorf("CORSOrigins = %v, want [http://localhost:3000]", c.CORSOrigins)
	}
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	// Clear DATABASE_URL explicitly
	_ = os.Unsetenv("DATABASE_URL")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing DATABASE_URL")
	}
}

func TestLoad_ProdJWTValidation(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "NODE_ENV", "production")
	setEnv(t, "CORS_ORIGIN", "https://app.example.com")

	// Default dev secret should fail in prod
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for dev JWT_SECRET in production")
	}

	// Too short
	setEnv(t, "JWT_SECRET", "short")
	_, err = Load()
	if err == nil {
		t.Fatal("expected error for short JWT_SECRET")
	}
}

func TestLoad_ProdCORSRequired(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "NODE_ENV", "production")
	setEnv(t, "JWT_SECRET", "a]vL9#mR2$xQ7!nW4@kF6^tY8&pU0*eJ3+hB5=dG1_cA-oI/sE.wZqMXbNfP")
	_ = os.Unsetenv("CORS_ORIGIN")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing CORS_ORIGIN in production")
	}
}

func TestLoad_CORSInvalidURL(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "CORS_ORIGIN", "not-a-url")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid CORS_ORIGIN URL")
	}
}

func TestLoad_AdminUserIDs(t *testing.T) {
	setEnv(t, "DATABASE_URL", "postgres://localhost/test")
	setEnv(t, "ADMIN_USER_IDS", "id1, id2 , id3")

	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.AdminUserIDs) != 3 {
		t.Errorf("AdminUserIDs len = %d, want 3", len(c.AdminUserIDs))
	}
}
