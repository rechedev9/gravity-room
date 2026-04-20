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

export const endpointMetadata = [
  { method: 'get', path: '/', alias: 'getIndex' },
  { method: 'post', path: '/api/auth/dev', alias: 'postApiAuthDev' },
  { method: 'post', path: '/api/auth/google', alias: 'postApiAuthGoogle' },
  { method: 'get', path: '/api/auth/me', alias: 'getApiAuthMe' },
  { method: 'patch', path: '/api/auth/me', alias: 'patchApiAuthMe' },
  { method: 'delete', path: '/api/auth/me', alias: 'deleteApiAuthMe' },
  { method: 'post', path: '/api/auth/mobile/google', alias: 'postApiAuthMobileGoogle' },
  { method: 'post', path: '/api/auth/mobile/refresh', alias: 'postApiAuthMobileRefresh' },
  { method: 'post', path: '/api/auth/mobile/signout', alias: 'postApiAuthMobileSignout' },
  { method: 'post', path: '/api/auth/refresh', alias: 'postApiAuthRefresh' },
  { method: 'post', path: '/api/auth/signout', alias: 'postApiAuthSignout' },
  { method: 'get', path: '/api/catalog/', alias: 'getApiCatalog' },
  { method: 'get', path: '/api/catalog/:programId', alias: 'getApiCatalogByProgramId' },
  { method: 'post', path: '/api/catalog/preview/', alias: 'postApiCatalogPreview' },
  { method: 'get', path: '/api/exercises', alias: 'getApiExercises' },
  { method: 'post', path: '/api/exercises', alias: 'postApiExercises' },
  { method: 'get', path: '/api/insights/', alias: 'getApiInsights' },
  { method: 'get', path: '/api/muscle-groups', alias: 'getApiMuscle-groups' },
  { method: 'get', path: '/api/programs/', alias: 'getApiPrograms' },
  { method: 'post', path: '/api/programs/', alias: 'postApiPrograms' },
  { method: 'get', path: '/api/programs/:id', alias: 'getApiProgramsById' },
  { method: 'patch', path: '/api/programs/:id', alias: 'patchApiProgramsById' },
  { method: 'delete', path: '/api/programs/:id', alias: 'deleteApiProgramsById' },
  { method: 'get', path: '/api/programs/:id/export', alias: 'getApiProgramsByIdExport' },
  { method: 'patch', path: '/api/programs/:id/metadata', alias: 'patchApiProgramsByIdMetadata' },
  { method: 'post', path: '/api/programs/:id/results', alias: 'postApiProgramsByIdResults' },
  {
    method: 'delete',
    path: '/api/programs/:id/results/:workoutIndex/:slotId',
    alias: 'deleteApiProgramsByIdResultsByWorkoutIndexBySlotId',
  },
  { method: 'post', path: '/api/programs/:id/undo', alias: 'postApiProgramsByIdUndo' },
  { method: 'post', path: '/api/programs/import', alias: 'postApiProgramsImport' },
  { method: 'get', path: '/api/stats/online', alias: 'getApiStatsOnline' },
  { method: 'get', path: '/health', alias: 'getHealth' },
  { method: 'get', path: '/metrics', alias: 'getMetrics' },
] as const;
