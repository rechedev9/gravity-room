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
import { vi } from 'vitest';
import { z } from 'zod/v4';
import { ExerciseEntrySchema } from '@gzclp/domain/schemas/exercises';
import { parseUserSafe as realParseUserSafe } from '@gzclp/domain/schemas/user';

const AuthProvidersResponseSchema = z.object({
  emailPassword: z.boolean(),
  google: z.boolean(),
  apple: z.boolean(),
  github: z.boolean(),
  microsoft: z.boolean(),
});

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

  // Public stats
  fetchAuthProviders: vi.fn(async () => {
    const res = await fetch('http://localhost:3001/api/auth/providers');
    return AuthProvidersResponseSchema.parse(await res.json());
  }),
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
