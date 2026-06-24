/**
 * Program routes — CRUD for program instances. All routes require auth.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  createInstance,
  getInstances,
  getInstance,
  updateInstance,
  updateInstanceMetadata,
  deleteInstance,
  exportInstance,
  importInstance,
  type ExportedProgram,
} from '../services/programs';
import {
  getCachedInstance,
  setCachedInstance,
  invalidateCachedInstance,
} from '../lib/program-cache';
import { SingleflightMap } from '../lib/singleflight';
import { ApiError } from '../middleware/error-handler';
import { MAX_PROGRAM_CONFIG_KEYS } from '@gzclp/domain/schemas/instance';

// Singleflight: concurrent GETs for the same program instance share one DB fetch
const instanceFlight = new SingleflightMap<unknown>();
const MAX_PROGRAM_CURSOR_CHARS = 256;
const MAX_PROGRAM_ID_CHARS = 50;
const MAX_SLOT_ID_CHARS = 50;
const MAX_WORKOUT_INDEX_KEY_CHARS = 3;
const MAX_AMRAP_REPS = 99;
const PROGRAM_ID_PATTERN = '^[a-z0-9-]+$';
const WORKOUT_INDEX_KEY_PATTERN = '^\\d{1,3}$';
const WORKOUT_INDEX_KEY_REGEX = /^\d{1,3}$/;

const programConfigSchema = t.Record(
  t.String({ maxLength: 30 }),
  t.Union([t.Number({ minimum: 0, maximum: 10000 }), t.String({ maxLength: 100 })]),
  { maxProperties: MAX_PROGRAM_CONFIG_KEYS }
);
const programIdSchema = t.String({
  minLength: 1,
  maxLength: MAX_PROGRAM_ID_CHARS,
  pattern: PROGRAM_ID_PATTERN,
});
const slotIdSchema = t.String({ minLength: 1, maxLength: MAX_SLOT_ID_CHARS });
const workoutIndexKeySchema = t.String({
  minLength: 1,
  maxLength: MAX_WORKOUT_INDEX_KEY_CHARS,
  pattern: WORKOUT_INDEX_KEY_PATTERN,
});

const security = [{ bearerAuth: [] }];

function assertImportPayloadKeysInBounds(
  data: Pick<ExportedProgram, 'results' | 'undoHistory'>
): void {
  for (const [workoutIndex, slots] of Object.entries(data.results)) {
    if (
      workoutIndex.length > MAX_WORKOUT_INDEX_KEY_CHARS ||
      !WORKOUT_INDEX_KEY_REGEX.test(workoutIndex)
    ) {
      throw new ApiError(400, 'Invalid import result workout index', 'INVALID_DATA');
    }
    for (const slotId of Object.keys(slots)) {
      if (slotId.length < 1 || slotId.length > MAX_SLOT_ID_CHARS) {
        throw new ApiError(400, 'Invalid import result slotId', 'INVALID_DATA');
      }
    }
  }

  for (const entry of data.undoHistory) {
    if (entry.slotId.length < 1 || entry.slotId.length > MAX_SLOT_ID_CHARS) {
      throw new ApiError(400, 'Invalid import undo slotId', 'INVALID_DATA');
    }
  }
}

export const programRoutes = new Elysia({ prefix: '/programs' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  // GET /programs — list user's program instances (cursor-based pagination)
  .get(
    '/',
    async ({ userId, query }) => {
      await rateLimit(userId, 'GET /programs', { maxRequests: 100 });
      return getInstances(userId, { limit: query.limit, cursor: query.cursor });
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        cursor: t.Optional(t.String({ maxLength: MAX_PROGRAM_CURSOR_CHARS })),
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

  // POST /programs — create a new program instance from the catalog
  .post(
    '/',
    async ({ userId, body, set, reqLogger }) => {
      reqLogger.info({ event: 'program.create', userId }, 'creating program instance');
      await rateLimit(userId, 'POST /programs');
      const instance = await createInstance(userId, body.programId, body.name, body.config);
      set.status = 201;
      return instance;
    },
    {
      body: t.Object({
        programId: programIdSchema,
        name: t.String({ minLength: 1, maxLength: 100 }),
        config: programConfigSchema,
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Create a program instance',
        description:
          'Creates a new program instance for the authenticated user from the catalog. `config` holds the starting weights keyed by exercise ID.',
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
  .get(
    '/:id',
    async ({ userId, params }) => {
      await rateLimit(userId, 'GET /programs/:id', { maxRequests: 100 });
      const cached = await getCachedInstance(userId, params.id);
      if (cached) return cached;

      // Singleflight: concurrent GETs for the same instance share one DB fetch
      return instanceFlight.run(`${userId}:${params.id}`, async () => {
        const rechecked = await getCachedInstance(userId, params.id);
        if (rechecked) return rechecked;
        const fresh = await getInstance(userId, params.id);
        await setCachedInstance(userId, params.id, fresh);
        return fresh;
      });
    },
    {
      params: t.Object({
        id: t.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
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
    }
  )

  // PATCH /programs/:id — update a program instance
  .patch(
    '/:id',
    async ({ userId, params, body, reqLogger }) => {
      reqLogger.info(
        { event: 'program.update', userId, instanceId: params.id },
        'updating program instance'
      );
      await rateLimit(userId, 'PATCH /programs');
      const result = await updateInstance(userId, params.id, body);
      await invalidateCachedInstance(userId, params.id);
      return result;
    },
    {
      params: t.Object({
        id: t.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        status: t.Optional(
          t.Union([t.Literal('active'), t.Literal('completed'), t.Literal('archived')])
        ),
        config: t.Optional(programConfigSchema),
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

  // PATCH /programs/:id/metadata — update program instance metadata (deep-merge)
  .patch(
    '/:id/metadata',
    async ({ userId, params, body, reqLogger }) => {
      reqLogger.info(
        { event: 'program.updateMetadata', userId, instanceId: params.id },
        'updating program metadata'
      );
      await rateLimit(userId, 'PATCH /programs/metadata');
      const result = await updateInstanceMetadata(userId, params.id, body.metadata);
      await invalidateCachedInstance(userId, params.id);
      return result;
    },
    {
      params: t.Object({
        id: t.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      body: t.Object({
        metadata: t.Record(
          t.String({ maxLength: 50 }),
          t.Union([t.String({ maxLength: 500 }), t.Number(), t.Boolean(), t.Null()])
        ),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Update program metadata',
        description:
          'Deep-merges the provided metadata with existing metadata on the program instance. Used for graduation state, bodyweight snapshots, etc.',
        security,
        responses: {
          200: { description: 'Updated program instance with merged metadata' },
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
    async ({ userId, params, set, reqLogger }) => {
      reqLogger.info(
        { event: 'program.delete', userId, instanceId: params.id },
        'deleting program instance'
      );
      await rateLimit(userId, 'DELETE /programs');
      await deleteInstance(userId, params.id);
      await invalidateCachedInstance(userId, params.id);
      set.status = 204;
    },
    {
      params: t.Object({
        id: t.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
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
  .get(
    '/:id/export',
    async ({ userId, params }) => {
      await rateLimit(userId, 'GET /programs/:id/export', { maxRequests: 20 });
      return exportInstance(userId, params.id);
    },
    {
      params: t.Object({
        id: t.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
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
    }
  )

  // POST /programs/import — import a program from exported JSON
  .post(
    '/import',
    async ({ userId, body, set, reqLogger }) => {
      assertImportPayloadKeysInBounds(body);
      reqLogger.info({ event: 'program.import', userId }, 'importing program instance');
      await rateLimit(userId, 'POST /programs/import');
      const instance = await importInstance(userId, body);
      set.status = 201;
      return instance;
    },
    {
      body: t.Object({
        version: t.Literal(1),
        exportDate: t.String({ format: 'date-time' }),
        programId: programIdSchema,
        name: t.String({ minLength: 1, maxLength: 100 }),
        config: programConfigSchema,
        // Bounded to keep a single import from forcing an unbounded in-memory
        // array + one huge transaction. Outer key = workoutIndex (capped well
        // above any real program length); inner key = slotId (capped above any
        // real day's slot count). undoHistory below is bounded the same way.
        results: t.Record(
          workoutIndexKeySchema,
          t.Record(
            slotIdSchema,
            t.Object({
              result: t.Optional(t.Union([t.Literal('success'), t.Literal('fail')])),
              amrapReps: t.Optional(t.Integer({ minimum: 0, maximum: MAX_AMRAP_REPS })),
              rpe: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
            }),
            { maxProperties: 50 }
          ),
          { maxProperties: 1000 }
        ),
        undoHistory: t.Array(
          t.Object({
            i: t.Integer({ minimum: 0 }),
            slotId: slotIdSchema,
            prev: t.Optional(t.Union([t.Literal('success'), t.Literal('fail')])),
            prevRpe: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
            prevAmrapReps: t.Optional(t.Integer({ minimum: 0, maximum: MAX_AMRAP_REPS })),
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
