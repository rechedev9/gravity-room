/**
 * Program definition routes — CRUD for user-created program definitions.
 * All routes require auth.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  create,
  list,
  getById,
  update,
  softDelete,
  updateStatus,
} from '../services/program-definitions';
import { ApiError } from '../middleware/error-handler';

const security = [{ bearerAuth: [] }];

const HOUR_MS = 3_600_000;

export const programDefinitionRoutes = new Elysia({ prefix: '/program-definitions' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  // POST /program-definitions — create a new program definition
  .post(
    '/',
    async ({ userId, body, set, reqLogger }) => {
      reqLogger.info({ event: 'programDefinition.create', userId }, 'creating program definition');
      await rateLimit(userId, 'POST /program-definitions', {
        windowMs: HOUR_MS,
        maxRequests: 5,
      });
      const result = await create(userId, body.definition);
      set.status = 201;
      return result;
    },
    {
      body: t.Object({
        definition: t.Any(),
      }),
      detail: {
        tags: ['Program Definitions'],
        summary: 'Create program definition',
        description:
          'Creates a new custom program definition. The definition payload is validated against ProgramDefinitionSchema. Source must be "custom".',
        security,
        responses: {
          201: { description: 'Program definition created' },
          401: { description: 'Missing or invalid token' },
          409: { description: 'Definition limit reached (max 10)' },
          422: { description: 'Invalid definition payload' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // GET /program-definitions — list user's own definitions
  .get('/', ({ userId, query }) => list(userId, query.offset ?? 0, query.limit ?? 20), {
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Numeric({ minimum: 0 })),
    }),
    detail: {
      tags: ['Program Definitions'],
      summary: 'List own program definitions',
      description:
        "Returns the authenticated user's program definitions, newest first. Supports offset-based pagination.",
      security,
      responses: {
        200: { description: 'Paginated list of program definitions' },
        401: { description: 'Missing or invalid token' },
      },
    },
  })

  // GET /program-definitions/:id — get a single definition
  .get(
    '/:id',
    async ({ userId, params }) => {
      const result = await getById(userId, params.id);
      if (!result) {
        throw new ApiError(404, 'Program definition not found', 'NOT_FOUND');
      }
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['Program Definitions'],
        summary: 'Get program definition',
        description: 'Returns a single program definition with full payload.',
        security,
        responses: {
          200: { description: 'Program definition' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Not found or not owned by user' },
        },
      },
    }
  )

  // PUT /program-definitions/:id — update a definition
  .put('/:id', ({ userId, params, body }) => update(userId, params.id, body.definition), {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      definition: t.Any(),
    }),
    detail: {
      tags: ['Program Definitions'],
      summary: 'Update program definition',
      description:
        'Updates a program definition. Resets status to draft if currently pending_review or approved.',
      security,
      responses: {
        200: { description: 'Updated program definition' },
        401: { description: 'Missing or invalid token' },
        404: { description: 'Not found or not owned by user' },
        422: { description: 'Invalid definition payload' },
      },
    },
  })

  // DELETE /program-definitions/:id — soft delete
  .delete(
    '/:id',
    async ({ userId, params, set, reqLogger }) => {
      reqLogger.info(
        { event: 'programDefinition.delete', userId, id: params.id },
        'deleting program definition'
      );
      const deleted = await softDelete(userId, params.id);
      if (!deleted) {
        throw new ApiError(404, 'Program definition not found', 'NOT_FOUND');
      }
      set.status = 204;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['Program Definitions'],
        summary: 'Delete program definition',
        description: 'Soft deletes a program definition (sets deletedAt timestamp).',
        security,
        responses: {
          204: { description: 'Deleted successfully' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Not found or not owned by user' },
        },
      },
    }
  )

  // PATCH /program-definitions/:id/status — transition status
  .patch(
    '/:id/status',
    async ({ userId, params, body, reqLogger }) => {
      reqLogger.info(
        { event: 'programDefinition.statusUpdate', userId, id: params.id, newStatus: body.status },
        'updating program definition status'
      );
      return updateStatus(userId, params.id, body.status);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([
          t.Literal('draft'),
          t.Literal('pending_review'),
          t.Literal('approved'),
          t.Literal('rejected'),
        ]),
      }),
      detail: {
        tags: ['Program Definitions'],
        summary: 'Transition definition status',
        description:
          'Transitions the definition status. Owner can submit for review or withdraw. Admin can approve or reject.',
        security,
        responses: {
          200: { description: 'Updated program definition with new status' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Forbidden — invalid transition or insufficient role' },
          404: { description: 'Not found' },
        },
      },
    }
  );
