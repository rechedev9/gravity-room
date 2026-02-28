/**
 * Catalog routes — public endpoints serving program definitions from the database.
 * No auth required — these are read-only reference data.
 */
import { Elysia, t } from 'elysia';
import { listPrograms, getProgramDefinition } from '../services/catalog';
import { rateLimit } from '../middleware/rate-limit';
import { ApiError } from '../middleware/error-handler';

export const catalogRoutes = new Elysia({ prefix: '/catalog' })

  // GET /catalog — list all available program definitions
  .get(
    '/',
    async ({ headers, set }) => {
      const ip = headers['x-forwarded-for'] ?? 'anonymous';
      await rateLimit(ip, 'GET /catalog', { maxRequests: 100 });
      const result = await listPrograms();
      set.headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=60';
      return result;
    },
    {
      detail: {
        tags: ['Catalog'],
        summary: 'List program definitions',
        description:
          'Returns all available preset program definitions from the database. No authentication required.',
        responses: {
          200: { description: 'Array of catalog entries' },
        },
      },
    }
  )

  // GET /catalog/:programId — get a specific hydrated program definition
  .get(
    '/:programId',
    async ({ params, headers, set }) => {
      const ip = headers['x-forwarded-for'] ?? 'anonymous';
      await rateLimit(ip, 'GET /catalog/:id', { maxRequests: 100 });
      const result = await getProgramDefinition(params.programId);
      if (result.status === 'not_found') {
        throw new ApiError(404, 'Program not found', 'PROGRAM_NOT_FOUND');
      }
      if (result.status === 'hydration_failed') {
        throw new ApiError(500, 'Program definition hydration failed', 'HYDRATION_FAILED');
      }
      set.headers['Cache-Control'] = 'public, max-age=300';
      return result.definition;
    },
    {
      params: t.Object({ programId: t.String() }),
      detail: {
        tags: ['Catalog'],
        summary: 'Get program definition',
        description:
          'Returns a single hydrated program definition by ID (e.g. `"gzclp"`). No authentication required.',
        responses: {
          200: { description: 'Hydrated program definition' },
          404: { description: 'Unknown program ID' },
          500: { description: 'Hydration failure — corrupted program data' },
        },
      },
    }
  );
