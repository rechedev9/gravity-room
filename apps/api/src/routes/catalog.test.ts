/**
 * Catalog routes integration tests — public endpoints for program definitions.
 * All routes are public (no auth required).
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

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

mock.module('../services/catalog', () => ({
  listPrograms: mockListPrograms,
  getProgramDefinition: mockGetProgramDefinition,
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
