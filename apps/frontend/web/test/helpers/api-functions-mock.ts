/**
 * Exhaustive stub set for `@/lib/api-functions` mocks.
 *
 * Every test that calls `vi.mock('@/lib/api-functions', ...)` replaces the
 * module with whatever object the factory returns. A partial mock breaks any
 * component in the same file that imports an export the factory omits.
 * Spreading `apiFunctionsStubs` guarantees all runtime exports are present,
 * and lets tests override only the ones they actually exercise:
 *
 * ```ts
 * vi.mock('@/lib/api-functions', () => ({
 *   ...apiFunctionsStubs,
 *   fetchMe: mockFetchMe,
 * }));
 * ```
 *
 * Keep this file in lockstep with the real module's runtime export list — if
 * you add a new exported function to `apps/frontend/web/src/lib/api-functions.ts`,
 * add a stub here too.
 *
 * Every stub must be hermetic: no stub may touch the real network, even as a
 * "sensible default".
 */
import { vi } from 'vitest';
import { ExerciseEntrySchema } from '@gzclp/domain/schemas/exercises';
import { parseUserSafe as realParseUserSafe } from '@gzclp/domain/schemas/user';

export const apiFunctionsStubs = {
  // Auth-aware fetch wrapper
  apiFetch: vi.fn(() => Promise.reject(new Error('apiFetch not configured in this test'))),

  // Program instances
  fetchPrograms: vi.fn(() => Promise.resolve([])),
  createProgram: vi.fn(() => Promise.resolve({})),
  updateProgramConfig: vi.fn(() => Promise.resolve()),
  updateProgramMetadata: vi.fn(() => Promise.resolve({})),
  completeProgram: vi.fn(() => Promise.resolve()),
  deleteProgram: vi.fn(() => Promise.resolve()),
  undoLastResult: vi.fn(() => Promise.resolve()),
  exportProgram: vi.fn(() => Promise.resolve({})),
  importProgram: vi.fn(() => Promise.resolve({})),

  // User profile
  fetchMe: vi.fn(() => Promise.resolve(null)),
  updateProfile: vi.fn(() => Promise.resolve({})),
  deleteAccount: vi.fn(() => Promise.resolve()),
  // Real implementation by default — pure Zod parser, safe to use across tests.
  parseUserSafe: vi.fn((data: unknown) => realParseUserSafe(data)),

  // Public stats — static shape, never touches the network: a default stub
  // must stay hermetic even when a test forgets to override it.
  fetchAuthProviders: vi.fn(() =>
    Promise.resolve({
      emailPassword: true,
      google: false,
      apple: false,
      github: false,
      microsoft: false,
    })
  ),
  fetchOnlineCount: vi.fn(() => Promise.resolve(null)),

  // Generic (slot-keyed) program operations
  fetchGenericProgramDetail: vi.fn(() => Promise.resolve(null)),
  recordGenericResult: vi.fn(() => Promise.resolve()),
  deleteGenericResult: vi.fn(() => Promise.resolve()),

  // Catalog
  fetchCatalogList: vi.fn(() => Promise.resolve([])),
  fetchCatalogDetail: vi.fn(() => Promise.resolve(null)),

  // Exercises — real Zod parser by default so tests that exercise the schema
  // directly (api-functions.test.ts) keep working even when another test in
  // the same process has already swapped this mock in.
  parseExerciseEntry: vi.fn((raw: unknown) => ExerciseEntrySchema.parse(raw)),
  fetchExercises: vi.fn(() => Promise.resolve({ data: [], total: 0, offset: 0, limit: 0 })),
  fetchMuscleGroups: vi.fn(() => Promise.resolve([])),

  // Insights
  fetchInsights: vi.fn(() => Promise.resolve([])),
};
