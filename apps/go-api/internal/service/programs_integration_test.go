package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reche/gravity-room/apps/go-api/internal/apierror"
	"github.com/reche/gravity-room/apps/go-api/internal/db"
	"github.com/reche/gravity-room/apps/go-api/internal/migrate"
	"github.com/reche/gravity-room/apps/go-api/internal/seed"
)

// testPool is the shared pool for integration tests. Nil when TEST_DB_URL is unset.
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DB_URL")
	if dbURL != "" {
		ctx := context.Background()
		if err := migrate.Run(ctx, dbURL); err != nil {
			fmt.Fprintf(os.Stderr, "integration setup: migrate: %v\n", err)
			os.Exit(1)
		}
		pool, err := db.New(ctx, dbURL, 5)
		if err != nil {
			fmt.Fprintf(os.Stderr, "integration setup: pool: %v\n", err)
			os.Exit(1)
		}
		if err := seed.Run(ctx, pool); err != nil {
			fmt.Fprintf(os.Stderr, "integration setup: seed: %v\n", err)
			os.Exit(1)
		}
		testPool = pool
		code := m.Run()
		pool.Close()
		os.Exit(code)
	}
	os.Exit(m.Run())
}

// requireTestDB returns the shared pool or skips the test if TEST_DB_URL was not set.
func requireTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DB_URL not set — skipping integration test")
	}
	return testPool
}

// setupTest returns the shared pool, a new test user ID, and a background context.
// The user (and all cascade-linked rows) is deleted when the test ends.
func setupTest(t *testing.T) (*pgxpool.Pool, string, context.Context) {
	t.Helper()
	pool := requireTestDB(t)
	userID := createTestUser(t, pool)
	return pool, userID, context.Background()
}

// createTestUser inserts a minimal user row and registers cleanup via FK cascade.
func createTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	userID := uuid.NewString()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO users (id, email, google_id, name)
		VALUES ($1, $2, $3, 'Integration Test User')
	`, userID, userID+"@test.invalid", userID)
	if err != nil {
		t.Fatalf("createTestUser: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userID)
	})
	return userID
}

// assertApiError fails the test unless err is an *apierror.ApiError with the given code.
func assertApiError(t *testing.T, err error, wantCode string) {
	t.Helper()
	if err == nil {
		t.Fatal("expected ApiError, got nil")
	}
	apiErr, ok := err.(*apierror.ApiError)
	if !ok {
		t.Fatalf("expected *apierror.ApiError, got %T: %v", err, err)
	}
	if apiErr.Code != wantCode {
		t.Errorf("error code = %q, want %q", apiErr.Code, wantCode)
	}
}

// catalogProgramID is a known active catalog program used across integration tests.
const catalogProgramID = "gzclp"

// baseImportData returns a valid minimal import envelope for catalogProgramID.
func baseImportData(name string) map[string]any {
	return map[string]any{
		"version":     float64(1),
		"exportDate":  "2026-01-01T00:00:00.000Z",
		"programId":   catalogProgramID,
		"name":        name,
		"config":      map[string]any{},
		"results":     map[string]any{},
		"undoHistory": []any{},
	}
}

// --- CreateInstance ---

func TestIntegration_CreateInstance(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	got, err := CreateInstance(ctx, pool, userID, catalogProgramID, "My Program", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if got.ID == "" {
		t.Error("expected non-empty ID")
	}
	if got.ProgramID != catalogProgramID {
		t.Errorf("programId = %q, want %q", got.ProgramID, catalogProgramID)
	}
	if got.Name != "My Program" {
		t.Errorf("name = %q, want %q", got.Name, "My Program")
	}
	if got.Status != "active" {
		t.Errorf("status = %q, want active", got.Status)
	}
	if got.CreatedAt == "" {
		t.Error("expected non-empty createdAt")
	}
}

func TestIntegration_CreateInstance_InvalidProgram(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	_, err := CreateInstance(ctx, pool, userID, "nonexistent-program", "x", map[string]any{})
	assertApiError(t, err, apierror.CodeInvalidProgram)
}

func TestIntegration_CreateInstance_AutoCompletes(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	first, err := CreateInstance(ctx, pool, userID, catalogProgramID, "First", map[string]any{})
	if err != nil {
		t.Fatalf("first CreateInstance: %v", err)
	}

	_, err = CreateInstance(ctx, pool, userID, catalogProgramID, "Second", map[string]any{})
	if err != nil {
		t.Fatalf("second CreateInstance: %v", err)
	}

	updated, err := GetInstance(ctx, pool, userID, first.ID)
	if err != nil {
		t.Fatalf("GetInstance after auto-complete: %v", err)
	}
	if updated.Status != "completed" {
		t.Errorf("first instance status = %q, want completed", updated.Status)
	}
}

// --- ListInstances ---

func TestIntegration_ListInstances(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	for i := range 3 {
		_, err := CreateInstance(ctx, pool, userID, catalogProgramID, fmt.Sprintf("Prog %d", i), map[string]any{})
		if err != nil {
			t.Fatalf("CreateInstance %d: %v", i, err)
		}
	}

	resp, err := ListInstances(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	if len(resp.Data) != 3 {
		t.Errorf("len(data) = %d, want 3", len(resp.Data))
	}
	if resp.NextCursor != nil {
		t.Errorf("expected nil cursor, got %q", *resp.NextCursor)
	}
}

func TestIntegration_ListInstances_Pagination(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	for i := range 5 {
		_, err := CreateInstance(ctx, pool, userID, catalogProgramID, fmt.Sprintf("Page %d", i), map[string]any{})
		if err != nil {
			t.Fatalf("CreateInstance %d: %v", i, err)
		}
	}

	page1, err := ListInstances(ctx, pool, userID, 3, "")
	if err != nil {
		t.Fatalf("ListInstances page1: %v", err)
	}
	if len(page1.Data) != 3 {
		t.Fatalf("page1 len = %d, want 3", len(page1.Data))
	}
	if page1.NextCursor == nil {
		t.Fatal("expected non-nil cursor on page1")
	}

	page2, err := ListInstances(ctx, pool, userID, 3, *page1.NextCursor)
	if err != nil {
		t.Fatalf("ListInstances page2: %v", err)
	}
	if len(page2.Data) != 2 {
		t.Errorf("page2 len = %d, want 2", len(page2.Data))
	}
	if page2.NextCursor != nil {
		t.Errorf("expected nil cursor on page2, got %q", *page2.NextCursor)
	}
}

// --- GetInstance ---

func TestIntegration_GetInstance(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Get Me", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	got, err := GetInstance(ctx, pool, userID, created.ID)
	if err != nil {
		t.Fatalf("GetInstance: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("id = %q, want %q", got.ID, created.ID)
	}
	if got.Results == nil {
		t.Error("expected non-nil results map")
	}
	if got.UndoHistory == nil {
		t.Error("expected non-nil undoHistory")
	}
}

func TestIntegration_GetInstance_WrongUser(t *testing.T) {
	pool, userID, ctx := setupTest(t)
	otherUserID := createTestUser(t, pool)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Secret", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	_, err = GetInstance(ctx, pool, otherUserID, created.ID)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

// --- UpdateInstance ---

func TestIntegration_UpdateInstance_Name(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Old Name", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	newName := "New Name"
	updated, err := UpdateInstance(ctx, pool, userID, created.ID, &newName, nil, nil)
	if err != nil {
		t.Fatalf("UpdateInstance: %v", err)
	}
	if updated.Name != newName {
		t.Errorf("name = %q, want %q", updated.Name, newName)
	}
	if updated.Status != "active" {
		t.Errorf("status changed unexpectedly: %q", updated.Status)
	}
}

func TestIntegration_UpdateInstance_Status(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Archive Me", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	status := "archived"
	updated, err := UpdateInstance(ctx, pool, userID, created.ID, nil, &status, nil)
	if err != nil {
		t.Fatalf("UpdateInstance: %v", err)
	}
	if updated.Status != status {
		t.Errorf("status = %q, want %q", updated.Status, status)
	}
}

func TestIntegration_UpdateInstance_NotFound(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	name := "x"
	_, err := UpdateInstance(ctx, pool, userID, uuid.NewString(), &name, nil, nil)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

func TestIntegration_UpdateInstance_WrongUser(t *testing.T) {
	pool, userID, ctx := setupTest(t)
	otherUserID := createTestUser(t, pool)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Owner Only", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	name := "hijacked"
	_, err = UpdateInstance(ctx, pool, otherUserID, created.ID, &name, nil, nil)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

// --- UpdateInstanceMetadata ---

func TestIntegration_UpdateInstanceMetadata(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Meta Test", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	meta := json.RawMessage(`{"theme":"dark","fontSize":14}`)
	updated, err := UpdateInstanceMetadata(ctx, pool, userID, created.ID, meta)
	if err != nil {
		t.Fatalf("UpdateInstanceMetadata: %v", err)
	}
	if updated.Metadata == nil {
		t.Fatal("expected non-nil metadata after update")
	}

	// Verify merge: second update must not drop first update's keys.
	meta2 := json.RawMessage(`{"lang":"es"}`)
	updated2, err := UpdateInstanceMetadata(ctx, pool, userID, created.ID, meta2)
	if err != nil {
		t.Fatalf("UpdateInstanceMetadata second merge: %v", err)
	}
	merged, ok := updated2.Metadata.(map[string]any)
	if !ok {
		t.Fatalf("metadata type = %T, want map[string]any", updated2.Metadata)
	}
	if merged["theme"] == nil {
		t.Error("expected 'theme' key to survive merge")
	}
	if merged["lang"] == nil {
		t.Error("expected 'lang' key from second update")
	}
}

func TestIntegration_UpdateInstanceMetadata_WrongUser(t *testing.T) {
	pool, userID, ctx := setupTest(t)
	otherUserID := createTestUser(t, pool)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Metadata Owner", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	_, err = UpdateInstanceMetadata(ctx, pool, otherUserID, created.ID, json.RawMessage(`{"evil":"true"}`))
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

func TestIntegration_UpdateInstanceMetadata_TooLarge(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Bloat", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	large := make([]byte, 10_001)
	for i := range large {
		large[i] = 'x'
	}
	_, err = UpdateInstanceMetadata(ctx, pool, userID, created.ID, json.RawMessage(`{"k":"`+string(large)+`"}`))
	assertApiError(t, err, apierror.CodeMetadataTooLarge)
}

// --- DeleteInstance ---

func TestIntegration_DeleteInstance(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Delete Me", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	if err := DeleteInstance(ctx, pool, userID, created.ID); err != nil {
		t.Fatalf("DeleteInstance: %v", err)
	}

	_, err = GetInstance(ctx, pool, userID, created.ID)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

func TestIntegration_DeleteInstance_WrongUser(t *testing.T) {
	pool, userID, ctx := setupTest(t)
	otherUserID := createTestUser(t, pool)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Mine", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	err = DeleteInstance(ctx, pool, otherUserID, created.ID)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

// --- ExportInstance ---

func TestIntegration_ExportInstance(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Export Me", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	exported, err := ExportInstance(ctx, pool, userID, created.ID)
	if err != nil {
		t.Fatalf("ExportInstance: %v", err)
	}

	for _, key := range []string{"version", "exportDate", "programId", "name", "config", "results", "undoHistory"} {
		if _, ok := exported[key]; !ok {
			t.Errorf("missing key %q in export", key)
		}
	}
	if exported["programId"] != catalogProgramID {
		t.Errorf("programId = %v, want %q", exported["programId"], catalogProgramID)
	}
	if exported["version"] != 1 {
		t.Errorf("version = %v, want 1", exported["version"])
	}
}

func TestIntegration_ExportInstance_WrongUser(t *testing.T) {
	pool, userID, ctx := setupTest(t)
	otherUserID := createTestUser(t, pool)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Private", map[string]any{})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	_, err = ExportInstance(ctx, pool, otherUserID, created.ID)
	assertApiError(t, err, apierror.CodeInstanceNotFound)
}

// --- ImportInstance ---

func TestIntegration_ImportInstance(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	imported, err := ImportInstance(ctx, pool, userID, baseImportData("Imported GZCLP"))
	if err != nil {
		t.Fatalf("ImportInstance: %v", err)
	}
	if imported.ID == "" {
		t.Error("expected non-empty ID")
	}
	if imported.ProgramID != catalogProgramID {
		t.Errorf("programId = %q, want %q", imported.ProgramID, catalogProgramID)
	}
	if imported.Name != "Imported GZCLP" {
		t.Errorf("name = %q, want %q", imported.Name, "Imported GZCLP")
	}
	if imported.Status != "active" {
		t.Errorf("status = %q, want active", imported.Status)
	}
}

func TestIntegration_ImportInstance_InvalidVersion(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	data := baseImportData("Bad Version")
	data["version"] = float64(99)

	_, err := ImportInstance(ctx, pool, userID, data)
	assertApiError(t, err, apierror.CodeInvalidData)
}

func TestIntegration_ImportInstance_MissingProgramID(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	data := baseImportData("No Program")
	delete(data, "programId")

	_, err := ImportInstance(ctx, pool, userID, data)
	if err == nil {
		t.Fatal("expected error for missing programId")
	}
}

func TestIntegration_ExportImport_RoundTrip(t *testing.T) {
	pool, userID, ctx := setupTest(t)

	created, err := CreateInstance(ctx, pool, userID, catalogProgramID, "Round Trip", map[string]any{"week": float64(3)})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	exported, err := ExportInstance(ctx, pool, userID, created.ID)
	if err != nil {
		t.Fatalf("ExportInstance: %v", err)
	}

	imported, err := ImportInstance(ctx, pool, userID, exported)
	if err != nil {
		t.Fatalf("ImportInstance: %v", err)
	}
	if imported.ProgramID != created.ProgramID {
		t.Errorf("programId = %q, want %q", imported.ProgramID, created.ProgramID)
	}
	if imported.Name != created.Name {
		t.Errorf("name = %q, want %q", imported.Name, created.Name)
	}
}
