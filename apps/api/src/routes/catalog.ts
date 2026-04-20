/**
 * Catalog routes — public endpoints serving program definitions from the database.
 * Public GET routes require no auth. POST /preview requires auth.
 */
import { Elysia, t } from 'elysia';
import { listPrograms, getProgramDefinition, previewDefinition } from '../services/catalog';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { requestLogger } from '../middleware/request-logger';
import { rateLimit } from '../middleware/rate-limit';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { ApiError } from '../middleware/error-handler';
import { isRecord } from '@gzclp/domain/type-guards';

const HOUR_MS = 3_600_000;
const security = [{ bearerAuth: [] }];

function parseMixedConfig(raw: unknown): Record<string, number | string> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .use(requestLogger)

  // --- Auth-protected preview route ---
  .group('/preview', (app) =>
    app
      .use(jwtPlugin)
      .resolve(resolveUserId)
      .post(
        '/',
        async ({ userId, body }) => {
          await rateLimit(userId, 'POST /catalog/preview', {
            windowMs: HOUR_MS,
            maxRequests: 30,
          });
          const parseResult = ProgramDefinitionSchema.safeParse(body.definition);
          if (!parseResult.success) {
            throw new ApiError(
              422,
              `Invalid program definition: ${parseResult.error.message}`,
              'VALIDATION_ERROR'
            );
          }
          const config = parseMixedConfig(body.config);
          const rows = previewDefinition(parseResult.data, config);
          return rows;
        },
        {
          body: t.Object({
            definition: t.Any(),
            config: t.Optional(t.Any()),
          }),
          detail: {
            tags: ['Catalog'],
            summary: 'Preview program definition',
            description:
              'Dry-runs a program definition and returns the first 10 workout rows. Requires authentication.',
            security,
            responses: {
              200: { description: 'Array of GenericWorkoutRow (max 10)' },
              401: { description: 'Missing or invalid token' },
              422: { description: 'Invalid definition payload' },
              429: { description: 'Rate limited' },
            },
          },
        }
      )
  )

  .use(requestLogger)

  // --- Public routes (no auth) ---

  // GET /catalog — list all available program definitions
  .get(
    '/',
    async ({ ip, set }) => {
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
    async ({ params, ip, set }) => {
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
