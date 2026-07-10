/**
 * Exercise routes — CRUD for exercises and muscle groups.
 * GET /exercises — optional auth (preset-only for unauthenticated, preset+own for authenticated)
 * GET /muscle-groups — no auth required
 * POST /exercises — auth required (creates a user-scoped exercise)
 */
import { Elysia, t } from 'elysia';
import { JWT_AUDIENCE, JWT_ISSUER, jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  listExercises,
  listMuscleGroups,
  createExercise,
  type ExerciseFilter,
} from '../services/exercises';
import { findUserById } from '../services/auth';
import { ApiError } from '../middleware/error-handler';

const security = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Helpers: query param parsing
// ---------------------------------------------------------------------------

/** Maximum number of values allowed in a comma-separated filter parameter. */
const MAX_FILTER_VALUES = 20;
const MAX_FILTER_VALUE_LENGTH = 80;
const MAX_FILTER_QUERY_LENGTH = MAX_FILTER_VALUES * MAX_FILTER_VALUE_LENGTH + MAX_FILTER_VALUES - 1;
const MAX_BOOLEAN_QUERY_LENGTH = 5;
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_OFFSET = 10_000;
const filterQuerySchema = t.String({ maxLength: MAX_FILTER_QUERY_LENGTH });

/** Split a comma-separated string into a trimmed non-empty array, or undefined. */
function parseCommaSeparated(value: string | undefined): readonly string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > MAX_FILTER_VALUES) {
    throw new ApiError(400, 'Too many filter values', 'INVALID_FILTER');
  }
  if (parts.some((part) => part.length > MAX_FILTER_VALUE_LENGTH)) {
    throw new ApiError(400, 'Filter value is too long', 'INVALID_FILTER');
  }
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
  if (!authorization) {
    return { userId: undefined };
  }

  if (!authorization.startsWith(BEARER_PREFIX)) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }

  const token = authorization.slice(BEARER_PREFIX.length);
  if (!token) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }

  const payload = await jwtCtx.verify(token);
  if (!payload) {
    throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
  }

  if (payload['iss'] !== JWT_ISSUER) {
    throw new ApiError(401, 'Invalid token issuer', 'TOKEN_INVALID');
  }

  const aud = payload['aud'];
  const audMatches = Array.isArray(aud) ? aud.includes(JWT_AUDIENCE) : aud === JWT_AUDIENCE;
  if (!audMatches) {
    throw new ApiError(401, 'Invalid token audience', 'TOKEN_INVALID');
  }

  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'Invalid token payload', 'TOKEN_INVALID');
  }

  const user = await findUserById(userId);
  if (!user || user.deletedAt) {
    throw new ApiError(401, 'User account is inactive', 'TOKEN_USER_INACTIVE');
  }
  const authVersion = payload['av'];
  if (!Number.isInteger(authVersion) || authVersion !== user.authVersion) {
    throw new ApiError(401, 'Token session has been revoked', 'TOKEN_REVOKED');
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
    async ({ jwt: jwtCtx, headers, query, set, ip }) => {
      const { userId } = await resolveOptionalUserId({ jwt: jwtCtx, headers });

      // Compound rate-limit key: userId:ip for authenticated, ip-only for anonymous
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
        q: t.Optional(t.String({ maxLength: MAX_SEARCH_QUERY_LENGTH })),
        muscleGroupId: t.Optional(filterQuerySchema),
        equipment: t.Optional(filterQuerySchema),
        force: t.Optional(filterQuerySchema),
        level: t.Optional(filterQuerySchema),
        mechanic: t.Optional(filterQuerySchema),
        category: t.Optional(filterQuerySchema),
        isCompound: t.Optional(t.String({ maxLength: MAX_BOOLEAN_QUERY_LENGTH })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 })),
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: MAX_OFFSET })),
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
    async ({ ip, set }) => {
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
        if (result.error.code === 'INVALID_EXERCISE_INPUT') {
          throw new ApiError(400, 'Invalid exercise input', 'VALIDATION_ERROR');
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
