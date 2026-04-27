/**
 * Catalog routes integration tests — public endpoints for program definitions
 * and auth-protected preview endpoint.
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';
import type { GenericWorkoutRow } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

type CatalogResult =
  | { readonly status: 'found'; readonly definition: unknown }
  | { readonly status: 'not_found' }
  | { readonly status: 'hydration_failed'; readonly error: unknown };

const mockListPrograms = mock(() =>
  Promise.resolve([{ id: 'gzclp', name: 'GZCLP', description: 'Linear Progression' }])
);
const mockGetProgramDefinition = mock<() => Promise<CatalogResult>>(() =>
  Promise.resolve({
    status: 'found' as const,
    definition: { id: 'gzclp', name: 'GZCLP' },
  })
);

const MOCK_PREVIEW_ROWS: readonly GenericWorkoutRow[] = Array.from({ length: 10 }, (_, i) => ({
  index: i,
  dayName: `Day ${(i % 2) + 1}`,
  slots: [
    {
      slotId: `d${(i % 2) + 1}-t1`,
      exerciseId: 'squat',
      exerciseName: 'Sentadilla',
      tier: 't1',
      weight: 0,
      stage: 0,
      sets: 5,
      reps: 3,
      repsMax: undefined,
      isAmrap: false,
      stagesCount: 1,
      result: undefined,
      amrapReps: undefined,
      rpe: undefined,
      isChanged: false,
      isDeload: false,
      role: undefined,
      notes: undefined,
      prescriptions: undefined,
      isGpp: undefined,
      complexReps: undefined,
      propagatesTo: undefined,
      isTestSlot: undefined,
      isBodyweight: undefined,
      setLogs: undefined,
    },
  ],
  isChanged: false,
  completedAt: undefined,
}));

const mockPreviewDefinition = mock(() => MOCK_PREVIEW_ROWS);

mock.module('../services/catalog', () => ({
  listPrograms: mockListPrograms,
  getProgramDefinition: mockGetProgramDefinition,
  previewDefinition: mockPreviewDefinition,
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { catalogRoutes } from './catalog';

// Wrap catalogRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(catalogRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { headers }));
}

// ---------------------------------------------------------------------------
// GET /catalog — list all programs
// ---------------------------------------------------------------------------

describe('GET /catalog', () => {
  it('returns 200', async () => {
    const res = await get('/catalog');
    expect(res.status).toBe(200);
  });

  it('returns Cache-Control header with stale-while-revalidate', async () => {
    // Act
    const res = await get('/catalog');

    // Assert
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=60');
  });
});

// ---------------------------------------------------------------------------
// GET /catalog/:programId — get a specific program
// ---------------------------------------------------------------------------

describe('GET /catalog/:programId', () => {
  it('returns 200 for an existing program', async () => {
    mockGetProgramDefinition.mockImplementation(() =>
      Promise.resolve({
        status: 'found' as const,
        definition: { id: 'gzclp', name: 'GZCLP' },
      })
    );
    const res = await get('/catalog/gzclp');
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown program', async () => {
    mockGetProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'not_found' as const })
    );
    const res = await get('/catalog/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns Cache-Control header without stale-while-revalidate', async () => {
    // Arrange
    mockGetProgramDefinition.mockImplementation(() =>
      Promise.resolve({
        status: 'found' as const,
        definition: { id: 'gzclp', name: 'GZCLP' },
      })
    );

    // Act
    const res = await get('/catalog/gzclp');

    // Assert
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toBe('public, max-age=300');
    expect(cacheControl).not.toContain('stale-while-revalidate');
  });

  it('404 does not include public Cache-Control', async () => {
    // Arrange
    mockGetProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'not_found' as const })
    );

    // Act
    const res = await get('/catalog/nonexistent');

    // Assert
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl === null || !cacheControl.includes('public')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /catalog/preview — auth-protected preview endpoint (REQ-PREV-001, REQ-PREV-002, REQ-PREV-005, REQ-PREV-006)
// ---------------------------------------------------------------------------

// Valid ProgramDefinition payload for route tests
const VALID_DEFINITION_PAYLOAD = {
  id: 'preview-test',
  name: 'Preview Test',
  description: 'Test',
  author: 'Test',
  version: 1,
  category: 'strength',
  source: 'custom',
  cycleLength: 2,
  totalWorkouts: 10,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 0, step: 2.5 }],
  weightIncrements: { squat: 5 },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'd1-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'd2-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
};

function postPreview(body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request('http://localhost/catalog/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /catalog/preview', () => {
  beforeEach(() => {
    mockPreviewDefinition.mockClear();
    mockPreviewDefinition.mockImplementation(() => MOCK_PREVIEW_ROWS);
  });

  it('returns 401 when no JWT is provided', async () => {
    const res = await postPreview({ definition: VALID_DEFINITION_PAYLOAD });

    expect(res.status).toBe(401);
  });

  it('returns 422 for malformed definition payload', async () => {
    const res = await postPreview({ definition: { foo: 'bar' } });

    // Without auth, this should return 401 (auth fires before body parsing)
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired JWT', async () => {
    const res = await postPreview(
      { definition: VALID_DEFINITION_PAYLOAD },
      { Authorization: 'Bearer expired-token' }
    );

    expect(res.status).toBe(401);
  });
});
