/**
 * Exercise routes — CRUD for exercises and muscle groups.
 * GET /exercises — optional auth (preset-only for unauthenticated, preset+own for authenticated)
 * GET /muscle-groups — no auth required
 * POST /exercises — auth required (creates a user-scoped exercise)
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  listExercises,
  listMuscleGroups,
  createExercise,
  type ExerciseFilter,
} from '../services/exercises';
import { ApiError } from '../middleware/error-handler';

const security = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Helpers: query param parsing
// ---------------------------------------------------------------------------

/** Maximum number of values allowed in a comma-separated filter parameter. */
const MAX_FILTER_VALUES = 20;

/** Split a comma-separated string into a trimmed non-empty array, or undefined. Capped at MAX_FILTER_VALUES. */
function parseCommaSeparated(value: string | undefined): readonly string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_FILTER_VALUES);
  return parts.length > 0 ? parts : undefined;
}

/** Parse "true"/"false" string to boolean, or undefined. */
function parseBooleanString(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Helper: optional auth — extracts userId from JWT if present, undefined otherwise
// ---------------------------------------------------------------------------

const BEARER_PREFIX = 'Bearer ';

async function resolveOptionalUserId({
  jwt: jwtCtx,
  headers,
}: {
  jwt: { verify: (token?: string) => Promise<Record<string, unknown> | false> };
  headers: Record<string, string | undefined>;
}): Promise<{ userId: string | undefined }> {
  const authorization = headers['authorization'];
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return { userId: undefined };
  }

  const token = authorization.slice(BEARER_PREFIX.length);
  if (!token) {
    return { userId: undefined };
  }

  const payload = await jwtCtx.verify(token);
  if (!payload) {
    return { userId: undefined };
  }

  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    return { userId: undefined };
  }

  return { userId };
}

// ---------------------------------------------------------------------------
// Public routes (optional auth or no auth)
// ---------------------------------------------------------------------------

const publicExerciseRoutes = new Elysia()
  .use(requestLogger)
  .use(jwtPlugin)

  // GET /exercises — optional auth: preset-only for unauthenticated, preset+own for authenticated
  .get(
    '/exercises',
    async ({ jwt: jwtCtx, headers, query, set }) => {
      const { userId } = await resolveOptionalUserId({ jwt: jwtCtx, headers });

      // Compound rate-limit key: userId:ip for authenticated, ip-only for anonymous
      const ip = headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'anonymous';
      const rateLimitKey = userId ? `${userId}:${ip}` : ip;
      await rateLimit(rateLimitKey, 'GET /exercises', { maxRequests: 100 });

      const filter: ExerciseFilter = {
        q: query.q || undefined,
        muscleGroupId: parseCommaSeparated(query.muscleGroupId),
        equipment: parseCommaSeparated(query.equipment),
        force: parseCommaSeparated(query.force),
        level: parseCommaSeparated(query.level),
        mechanic: parseCommaSeparated(query.mechanic),
        category: parseCommaSeparated(query.category),
        isCompound: parseBooleanString(query.isCompound),
      };

      const result = await listExercises(userId, filter, {
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
      });

      // Cache-Control for unauthenticated (preset-only) requests
      if (!userId) {
        set.headers['Cache-Control'] = 'public, max-age=300';
      }

      return result;
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        muscleGroupId: t.Optional(t.String()),
        equipment: t.Optional(t.String()),
        force: t.Optional(t.String()),
        level: t.Optional(t.String()),
        mechanic: t.Optional(t.String()),
        category: t.Optional(t.String()),
        isCompound: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      detail: {
        tags: ['Exercises'],
        summary: 'List exercises',
        description:
          'Returns preset exercises for unauthenticated requests, or preset + user-created exercises when authenticated. Supports filtering by text search (q), muscle group, equipment, force, level, mechanic, category (comma-separated for multi-value), and isCompound (true/false).',
        responses: {
          200: { description: 'Array of exercises' },
        },
      },
    }
  )

  // GET /muscle-groups — no auth required
  .get(
    '/muscle-groups',
    async ({ headers, set }) => {
      const ip = headers['x-forwarded-for'] ?? 'anonymous';
      await rateLimit(ip, 'GET /muscle-groups', { maxRequests: 100 });
      const result = await listMuscleGroups();
      set.headers['Cache-Control'] = 'public, max-age=600';
      return result;
    },
    {
      detail: {
        tags: ['Exercises'],
        summary: 'List muscle groups',
        description: 'Returns all muscle groups. No authentication required.',
        responses: {
          200: { description: 'Array of muscle groups' },
        },
      },
    }
  );

// ---------------------------------------------------------------------------
// Protected routes (auth required)
// ---------------------------------------------------------------------------

const protectedExerciseRoutes = new Elysia()
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  // POST /exercises — auth required: create a user-scoped exercise
  .post(
    '/exercises',
    async ({ userId, body, set, reqLogger }) => {
      reqLogger.info({ event: 'exercise.create', userId }, 'creating exercise');
      await rateLimit(userId, 'POST /exercises');

      const slug = body.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 50);

      if (!slug) {
        throw new ApiError(
          422,
          'Exercise name must contain at least one alphanumeric character',
          'INVALID_SLUG'
        );
      }

      const result = await createExercise(userId, {
        id: slug,
        name: body.name,
        muscleGroupId: body.muscleGroupId,
        equipment: body.equipment,
        isCompound: body.isCompound,
      });

      if (!result.ok) {
        if (result.error.code === 'EXERCISE_ID_CONFLICT') {
          throw new ApiError(409, 'Exercise ID already exists', 'DUPLICATE');
        }
        throw new ApiError(400, 'Invalid muscle group', 'VALIDATION_ERROR');
      }

      set.status = 201;
      return result.value;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        muscleGroupId: t.String({ minLength: 1, maxLength: 50 }),
        equipment: t.Optional(t.String({ maxLength: 50 })),
        isCompound: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Exercises'],
        summary: 'Create exercise',
        description:
          'Creates a user-scoped exercise. The exercise ID is derived from the name (lowercase, underscored). Returns 409 if the generated ID conflicts with an existing exercise.',
        security,
        responses: {
          201: { description: 'Exercise created' },
          400: { description: 'Invalid muscle group ID' },
          401: { description: 'Missing or invalid token' },
          409: { description: 'Exercise ID already exists' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

export const exerciseRoutes = new Elysia().use(publicExerciseRoutes).use(protectedExerciseRoutes);
