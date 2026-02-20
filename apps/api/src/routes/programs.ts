/**
 * Program routes — CRUD for program instances. All routes require auth.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import {
  createInstance,
  getInstances,
  getInstance,
  updateInstance,
  deleteInstance,
  exportInstance,
  importInstance,
} from '../services/programs';

const security = [{ bearerAuth: [] }];

export const programRoutes = new Elysia({ prefix: '/programs' })
  .use(jwtPlugin)
  .resolve(resolveUserId)

  // GET /programs — list user's program instances (cursor-based pagination)
  .get(
    '/',
    ({ userId, query }) => getInstances(userId, { limit: query.limit, cursor: query.cursor }),
    {
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        cursor: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'List program instances',
        description:
          "Returns the authenticated user's program instances, newest first. Supports cursor-based pagination via the `cursor` query parameter (ISO timestamp from `nextCursor` in the previous response).",
        security,
        responses: {
          200: { description: 'Paginated list of program instances with nextCursor' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  )

  // POST /programs — create a new program instance
  .post(
    '/',
    async ({ userId, body, set }) => {
      await rateLimit(userId, 'POST /programs');
      const instance = await createInstance(userId, body.programId, body.name, body.config);
      set.status = 201;
      return instance;
    },
    {
      body: t.Object({
        programId: t.String({ minLength: 1 }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        config: t.Record(t.String({ maxLength: 30 }), t.Number({ minimum: 0, maximum: 10000 })),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Create a program instance',
        description:
          'Creates a new program instance for the authenticated user. `programId` must match a registered program definition (e.g. `"gzclp"`). `config` holds the starting weights keyed by exercise ID.',
        security,
        responses: {
          201: { description: 'Program instance created' },
          400: { description: 'Unknown programId or invalid config' },
          401: { description: 'Missing or invalid token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // GET /programs/:id — get a single program instance with results
  .get('/:id', ({ userId, params }) => getInstance(userId, params.id), {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ['Programs'],
      summary: 'Get program instance',
      description:
        'Returns a single program instance including all recorded workout results and undo history.',
      security,
      responses: {
        200: { description: 'Program instance with results and undo history' },
        401: { description: 'Missing or invalid token' },
        404: { description: 'Program not found or not owned by user' },
      },
    },
  })

  // PATCH /programs/:id — update a program instance
  .patch(
    '/:id',
    async ({ userId, params, body }) => {
      await rateLimit(userId, 'PATCH /programs');
      return updateInstance(userId, params.id, body);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        status: t.Optional(
          t.Union([t.Literal('active'), t.Literal('completed'), t.Literal('archived')])
        ),
        config: t.Optional(
          t.Record(t.String({ maxLength: 30 }), t.Number({ minimum: 0, maximum: 10000 }))
        ),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Update program instance',
        description:
          'Partially updates a program instance. Only provided fields are changed. Use `status` to archive or complete a program.',
        security,
        responses: {
          200: { description: 'Updated program instance' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // DELETE /programs/:id — delete a program instance
  .delete(
    '/:id',
    async ({ userId, params, set }) => {
      await rateLimit(userId, 'DELETE /programs');
      await deleteInstance(userId, params.id);
      set.status = 204;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['Programs'],
        summary: 'Delete program instance',
        description:
          'Permanently deletes the program instance and all associated workout results and undo history (cascade).',
        security,
        responses: {
          204: { description: 'Deleted successfully' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // GET /programs/:id/export — export a program instance as JSON
  .get('/:id/export', ({ userId, params }) => exportInstance(userId, params.id), {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ['Programs'],
      summary: 'Export program instance',
      description:
        'Exports the program instance as a portable JSON document that can be imported into any GZCLP Tracker account.',
      security,
      responses: {
        200: { description: 'Exported program JSON' },
        401: { description: 'Missing or invalid token' },
        404: { description: 'Program not found or not owned by user' },
      },
    },
  })

  // POST /programs/import — import a program from exported JSON
  .post(
    '/import',
    async ({ userId, body, set }) => {
      await rateLimit(userId, 'POST /programs/import');
      const instance = await importInstance(userId, body);
      set.status = 201;
      return instance;
    },
    {
      body: t.Object({
        version: t.Literal(1),
        exportDate: t.String(),
        programId: t.String({ minLength: 1 }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        config: t.Record(t.String({ maxLength: 30 }), t.Number({ minimum: 0, maximum: 10000 })),
        results: t.Record(
          t.String(),
          t.Record(
            t.String(),
            t.Object({
              result: t.Optional(t.Union([t.Literal('success'), t.Literal('fail')])),
              amrapReps: t.Optional(t.Integer({ minimum: 0 })),
            })
          )
        ),
        undoHistory: t.Array(
          t.Object({
            i: t.Integer({ minimum: 0 }),
            slotId: t.String({ minLength: 1 }),
            prev: t.Optional(t.Union([t.Literal('success'), t.Literal('fail')])),
          }),
          { maxItems: 500 }
        ),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Import program instance',
        description:
          'Imports a previously exported program JSON. All results and undo history are validated against the program definition before import.',
        security,
        responses: {
          201: { description: 'Program instance created from import' },
          400: {
            description:
              'Invalid export data (unknown programId, invalid config, or bad workout indices)',
          },
          401: { description: 'Missing or invalid token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );
