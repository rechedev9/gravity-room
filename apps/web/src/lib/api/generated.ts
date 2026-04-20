/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: ElysiaJS API /swagger/json endpoint
 * Regenerate: bun run api:types (from apps/web/)
 *
 * This file is committed to enable CI drift detection:
 *   bun run api:types && git diff --exit-code src/lib/api/generated.ts
 *
 * DO NOT import from this file in application code.
 * Use the hand-written schemas in @gzclp/domain/schemas/* instead.
 */
import { z } from 'zod/v4';

const patchApiAuthMe_Body = z
  .object({
    name: z.string().min(1).max(100),
    avatarUrl: z.union([z.string(), z.null()]).nullable(),
  })
  .partial()
  .passthrough()
  .readonly();
const limit = z.union([z.string(), z.number()]).optional();
const postApiPrograms_Body = z
  .object({
    programId: z.string().min(1),
    name: z.string().min(1).max(100),
    config: z.object({}).partial().passthrough().readonly(),
  })
  .passthrough()
  .readonly();
const patchApiProgramsById_Body = z
  .object({
    name: z.string().min(1).max(100),
    status: z.union([z.string(), z.string(), z.string()]),
    config: z.object({}).partial().passthrough().readonly(),
  })
  .partial()
  .passthrough()
  .readonly();
const postApiProgramsImport_Body = z
  .object({
    version: z.number(),
    exportDate: z.string().datetime({ offset: true }),
    programId: z.string().min(1),
    name: z.string().min(1).max(100),
    config: z.object({}).partial().passthrough().readonly(),
    results: z.object({}).partial().passthrough().readonly(),
    undoHistory: z
      .array(
        z
          .object({
            i: z.union([z.string(), z.number()]),
            slotId: z.string().min(1),
            prev: z.union([z.string(), z.string()]).optional(),
            prevRpe: z.union([z.string(), z.number()]).optional(),
            prevAmrapReps: z.union([z.string(), z.number()]).optional(),
          })
          .passthrough()
          .readonly()
      )
      .readonly()
      .max(500),
  })
  .passthrough()
  .readonly();
const postApiExercises_Body = z
  .object({
    name: z.string().min(1).max(100),
    muscleGroupId: z.string().min(1).max(50),
    equipment: z.string().max(50).optional(),
    isCompound: z.boolean().optional(),
  })
  .passthrough()
  .readonly();
const postApiProgramsByIdResults_Body = z
  .object({
    workoutIndex: z.union([z.string(), z.number()]),
    slotId: z.string().min(1),
    result: z.union([z.string(), z.string()]),
    amrapReps: z.union([z.string(), z.number()]).optional(),
    rpe: z.union([z.string(), z.number()]).optional(),
    setLogs: z
      .array(
        z
          .object({
            reps: z.union([z.string(), z.number()]),
            weight: z.number().gte(0).optional(),
            rpe: z.union([z.string(), z.number()]).optional(),
          })
          .passthrough()
          .readonly()
      )
      .readonly()
      .max(20)
      .optional(),
  })
  .passthrough()
  .readonly();
const workoutIndex = z.union([z.string(), z.number()]);

export const schemas = {
  patchApiAuthMe_Body,
  limit,
  postApiPrograms_Body,
  patchApiProgramsById_Body,
  postApiProgramsImport_Body,
  postApiExercises_Body,
  postApiProgramsByIdResults_Body,
  workoutIndex,
};

export const endpoints = [
  {
    method: 'get',
    path: '',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'post',
    path: '/api/auth/dev',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ email: z.string().email() }).passthrough().readonly(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/api/auth/google',
    description: `Verifies a Google ID token (RS256 + JWKS), finds or creates the user, and issues tokens.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z
          .object({ credential: z.string().min(1) })
          .passthrough()
          .readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Invalid or expired Google credential`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/auth/me',
    description: `Returns the authenticated user&#x27;s profile from the Bearer access token.`,
    requestFormat: 'json',
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `User not found (deleted after token was issued)`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'patch',
    path: '/api/auth/me',
    description: `Updates name and/or avatar. Send avatarUrl: null to remove the avatar.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: patchApiAuthMe_Body,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid avatar format or size`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'delete',
    path: '/api/auth/me',
    description: `Soft-deletes the user account (sets deleted_at). All refresh tokens are revoked. Data is purged after 30 days.`,
    requestFormat: 'json',
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/auth/mobile/google',
    description: `Verifies a Google ID token, finds or creates the user, and returns both access and refresh tokens in the response body.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z
          .object({ credential: z.string().min(1) })
          .passthrough()
          .readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Invalid or expired Google credential`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/auth/mobile/refresh',
    description: `Rotates the mobile refresh token and returns a new access token, refresh token, and current user profile in the response body.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ refreshToken: z.string() }).partial().passthrough().readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing, invalid, expired, or reused refresh token`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/auth/mobile/signout',
    description: `Revokes the provided refresh token when present.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z
          .object({ refreshToken: z.string().min(1) })
          .partial()
          .passthrough()
          .readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/auth/refresh',
    description: `Rotates the refresh token (family tracking for theft detection) and issues a new short-lived access token.`,
    requestFormat: 'json',
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing, invalid, expired, or reused refresh token`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/auth/signout',
    description: `Revokes the current refresh token and clears the cookie.`,
    requestFormat: 'json',
    response: z.void(),
    errors: [
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/catalog/',
    description: `Returns all available preset program definitions from the database. No authentication required.`,
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/api/catalog/:programId',
    description: `Returns a single hydrated program definition by ID (e.g. &#x60;&quot;gzclp&quot;&#x60;). No authentication required.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'programId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 404,
        description: `Unknown program ID`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `Hydration failure — corrupted program data`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/catalog/preview/',
    description: `Dry-runs a program definition and returns the first 10 workout rows. Requires authentication.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z
          .object({ definition: z.unknown(), config: z.unknown().optional() })
          .passthrough()
          .readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 422,
        description: `Invalid definition payload`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/exercises',
    description: `Returns preset exercises for unauthenticated requests, or preset + user-created exercises when authenticated. Supports filtering by text search (q), muscle group, equipment, force, level, mechanic, category (comma-separated for multi-value), and isCompound (true/false).`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'q',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'muscleGroupId',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'equipment',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'force',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'level',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'mechanic',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'category',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'isCompound',
        type: 'Query',
        schema: z.string().optional(),
      },
      {
        name: 'limit',
        type: 'Query',
        schema: limit,
      },
      {
        name: 'offset',
        type: 'Query',
        schema: limit,
      },
    ],
    response: z.void(),
  },
  {
    method: 'post',
    path: '/api/exercises',
    description: `Creates a user-scoped exercise. The exercise ID is derived from the name (lowercase, underscored). Returns 409 if the generated ID conflicts with an existing exercise.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: postApiExercises_Body,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid muscle group ID`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `Exercise ID already exists`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/insights/',
    description: `Returns pre-computed analytics insights for the authenticated user. Optionally filter by comma-separated insight types. Valid values: volume_trend, frequency, plateau_detection, load_recommendation. Unknown types return 400 with { code: &quot;INVALID_INSIGHT_TYPE&quot;, invalidValues, validValues }.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'types',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
  },
  {
    method: 'get',
    path: '/api/muscle-groups',
    description: `Returns all muscle groups. No authentication required.`,
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/api/programs/',
    description: `Returns the authenticated user&#x27;s program instances, newest first. Supports cursor-based pagination via the &#x60;cursor&#x60; query parameter (ISO timestamp from &#x60;nextCursor&#x60; in the previous response).`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limit,
      },
      {
        name: 'cursor',
        type: 'Query',
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/programs/',
    description: `Creates a new program instance for the authenticated user from the catalog. &#x60;config&#x60; holds the starting weights keyed by exercise ID.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: postApiPrograms_Body,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Unknown programId or invalid config`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/programs/:id',
    description: `Returns a single program instance including all recorded workout results and undo history.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'patch',
    path: '/api/programs/:id',
    description: `Partially updates a program instance. Only provided fields are changed. Use &#x60;status&#x60; to archive or complete a program.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: patchApiProgramsById_Body,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'delete',
    path: '/api/programs/:id',
    description: `Permanently deletes the program instance and all associated workout results and undo history (cascade).`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/programs/:id/export',
    description: `Exports the program instance as a portable JSON document that can be imported into any GZCLP Tracker account.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'patch',
    path: '/api/programs/:id/metadata',
    description: `Deep-merges the provided metadata with existing metadata on the program instance. Used for graduation state, bodyweight snapshots, etc.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z
          .object({ metadata: z.object({}).partial().passthrough().readonly() })
          .passthrough()
          .readonly(),
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/programs/:id/results',
    description: `Upserts a result for a given workout index and slot (tier). Automatically pushes an undo entry capturing the previous state.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: postApiProgramsByIdResults_Body,
      },
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid amrapReps or bad slot ID`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'delete',
    path: '/api/programs/:id/results/:workoutIndex/:slotId',
    description: `Removes a recorded result and pushes an undo entry so the deletion can be reversed.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
      {
        name: 'workoutIndex',
        type: 'Path',
        schema: workoutIndex,
      },
      {
        name: 'slotId',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Result or program not found`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/programs/:id/undo',
    description: `Pops the most recent undo entry (LIFO) and restores the previous result state. Returns &#x60;{ undone: null }&#x60; if nothing to undo.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `Program not found or not owned by user`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'post',
    path: '/api/programs/import',
    description: `Imports a previously exported program JSON. All results and undo history are validated against the program definition before import.`,
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: postApiProgramsImport_Body,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid export data (unknown programId, invalid config, or bad workout indices)`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Missing or invalid token`,
        schema: z.void(),
      },
      {
        status: 429,
        description: `Rate limited`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/api/stats/online',
    description: `Returns the approximate number of users active in the last 60 seconds. Returns null when Redis is unavailable.`,
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'get',
    path: '/health',
    description: `Returns server uptime and a live database probe. Returns 503 when the database is unreachable.`,
    requestFormat: 'json',
    response: z.void(),
    errors: [
      {
        status: 503,
        description: `Database unreachable`,
        schema: z.void(),
      },
    ],
  },
  {
    method: 'get',
    path: '/metrics',
    requestFormat: 'json',
    response: z.void(),
  },
] as const;
