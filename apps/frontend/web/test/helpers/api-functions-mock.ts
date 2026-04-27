/**
 * Exhaustive stub set for `@/lib/api-functions` mocks.
 *
 * Why this exists: every test that calls `mock.module('@/lib/api-functions', ...)`
 * replaces the module with whatever object the factory returns. Bun runs the
 * whole `src/` test suite in a single process, so a partial mock from one file
 * leaks into the next. If a later test (or a component imported by a later
 * test) references an export the active mock omits, Bun fails with
 * `SyntaxError: Export named '<name>' not found in module '.../api-functions.ts'`.
 *
 * Spreading `apiFunctionsStubs` into every mock guarantees that all 24 runtime
 * exports are at least present, and lets tests override only the ones they
 * actually exercise:
 *
 * ```ts
 * mock.module('@/lib/api-functions', () => ({
 *   ...apiFunctionsStubs,
 *   fetchMe: mockFetchMe,
 * }));
 * ```
 *
 * Keep this file in lockstep with the real module's runtime export list — if
 * you add a new exported function to `apps/frontend/web/src/lib/api-functions.ts`,
 * add a stub here too, otherwise tests will start failing with the same
 * SyntaxError.
 */
import { mock } from 'bun:test';
import { ExerciseEntrySchema } from '@gzclp/domain/schemas/exercises';
import { parseUserSafe as realParseUserSafe } from '@gzclp/domain/schemas/user';

export const apiFunctionsStubs = {
  // Auth-aware fetch wrapper
  apiFetch: mock(() => Promise.reject(new Error('apiFetch not configured in this test'))),

  // Program instances
  fetchPrograms: mock(() => Promise.resolve([])),
  createProgram: mock(() => Promise.resolve({})),
  updateProgramConfig: mock(() => Promise.resolve()),
  updateProgramMetadata: mock(() => Promise.resolve({})),
  completeProgram: mock(() => Promise.resolve()),
  deleteProgram: mock(() => Promise.resolve()),
  undoLastResult: mock(() => Promise.resolve()),
  exportProgram: mock(() => Promise.resolve({})),
  importProgram: mock(() => Promise.resolve({})),

  // User profile
  fetchMe: mock(() => Promise.resolve(null)),
  updateProfile: mock(() => Promise.resolve({})),
  deleteAccount: mock(() => Promise.resolve()),
  // Real implementation by default — pure Zod parser, safe to use across tests.
  parseUserSafe: mock((data: unknown) => realParseUserSafe(data)),

  // Public stats
  fetchOnlineCount: mock(() => Promise.resolve(null)),

  // Generic (slot-keyed) program operations
  fetchGenericProgramDetail: mock(() => Promise.resolve(null)),
  recordGenericResult: mock(() => Promise.resolve()),
  deleteGenericResult: mock(() => Promise.resolve()),

  // Catalog
  fetchCatalogList: mock(() => Promise.resolve([])),
  fetchCatalogDetail: mock(() => Promise.resolve(null)),

  // Exercises — real Zod parser by default so tests that exercise the schema
  // directly (api-functions.test.ts) keep working even when another test in
  // the same process has already swapped this mock in.
  parseExerciseEntry: mock((raw: unknown) => ExerciseEntrySchema.parse(raw)),
  fetchExercises: mock(() => Promise.resolve({ data: [], total: 0, offset: 0, limit: 0 })),
  fetchMuscleGroups: mock(() => Promise.resolve([])),

  // Insights
  fetchInsights: mock(() => Promise.resolve([])),
};
