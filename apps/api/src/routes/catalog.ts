/**
 * Catalog routes — public endpoints serving program definitions.
 * No auth required — these are read-only reference data.
 */
import { Elysia, t } from 'elysia';
import { getAllPresetPrograms, getProgramDefinition } from '@gzclp/shared/programs/registry';
import { ApiError } from '../middleware/error-handler';

export const catalogRoutes = new Elysia({ prefix: '/catalog' })

  // GET /catalog — list all available program definitions
  .get('/', () => getAllPresetPrograms(), {
    detail: {
      tags: ['Catalog'],
      summary: 'List program definitions',
      description:
        'Returns all available preset program definitions (e.g. GZCLP). No authentication required.',
      responses: {
        200: { description: 'Array of program definitions' },
      },
    },
  })

  // GET /catalog/:programId — get a specific program definition
  .get(
    '/:programId',
    ({ params }) => {
      const definition = getProgramDefinition(params.programId);
      if (!definition) {
        throw new ApiError(404, 'Program not found', 'PROGRAM_NOT_FOUND');
      }
      return definition;
    },
    {
      params: t.Object({ programId: t.String() }),
      detail: {
        tags: ['Catalog'],
        summary: 'Get program definition',
        description:
          'Returns a single program definition by ID (e.g. `"gzclp"`). No authentication required.',
        responses: {
          200: { description: 'Program definition' },
          404: { description: 'Unknown program ID' },
        },
      },
    }
  );
