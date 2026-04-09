/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: apps/go-api/internal/swagger/openapi.json
 * Regenerate: bun run api:types (from apps/web/)
 *
 * This file is committed to enable CI drift detection:
 *   bun run api:types && git diff --exit-code src/lib/api/generated.ts
 *
 * DO NOT import from this file in application code.
 * Use the hand-written schemas in lib/shared/schemas/ instead.
 */
import { z } from 'zod/v4';

const HealthResponse = z
  .object({
    status: z.string(),
    timestamp: z.string().datetime({ offset: true }),
    uptime: z.number().int(),
    db: z.object({}).partial().passthrough().readonly(),
    redis: z.object({}).partial().passthrough().readonly(),
  })
  .passthrough()
  .readonly();
const Error = z.object({ error: z.string(), code: z.string() }).passthrough().readonly();
const UserResponse = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .passthrough()
  .readonly();
const AuthResponse = z
  .object({ user: UserResponse, accessToken: z.string() })
  .passthrough()
  .readonly();
const RefreshResponse = z.object({ accessToken: z.string() }).passthrough().readonly();
const updateMe_Body = z
  .object({ name: z.string().min(1).max(100).nullable(), avatarUrl: z.string().nullable() })
  .partial()
  .passthrough()
  .readonly();
const ProgramInstanceListItem = z
  .object({
    id: z.string().uuid(),
    programId: z.string(),
    name: z.string(),
    status: z.enum(['active', 'completed', 'archived']),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .readonly();
const ProgramListResponse = z
  .object({ data: z.array(ProgramInstanceListItem).readonly(), nextCursor: z.string().nullable() })
  .passthrough()
  .readonly();
const createProgram_Body = z
  .object({
    programId: z.string().optional(),
    definitionId: z.string().optional(),
    name: z.string().min(1).max(100),
    config: z.object({}).partial().passthrough().readonly(),
  })
  .passthrough()
  .readonly();
const ProgramInstanceResponse = z
  .object({
    id: z.string().uuid(),
    programId: z.string(),
    name: z.string(),
    config: z.object({}).partial().passthrough().readonly(),
    metadata: z.unknown().nullable(),
    status: z.enum(['active', 'completed', 'archived']),
    results: z.object({}).partial().passthrough().readonly(),
    undoHistory: z.array(z.object({}).partial().passthrough().readonly()).readonly(),
    resultTimestamps: z.record(z.string()),
    completedDates: z.record(z.string()),
    definitionId: z.string().nullable(),
    customDefinition: z.unknown().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .readonly();
const updateProgram_Body = z
  .object({
    name: z.string().min(1).max(100),
    status: z.enum(['active', 'completed', 'archived']),
    config: z.object({}).partial().passthrough().readonly(),
  })
  .partial()
  .passthrough()
  .readonly();
const recordResult_Body = z
  .object({
    workoutIndex: z.number().int().gte(0),
    slotId: z.string(),
    result: z.string(),
    amrapReps: z.number().int().nullish(),
    rpe: z.number().int().nullish(),
    setLogs: z.unknown().nullish(),
  })
  .passthrough()
  .readonly();
const UndoResponse = z.object({ undone: z.unknown().nullable() }).passthrough().readonly();
const CatalogEntry = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    category: z.string(),
    level: z.string(),
    source: z.string(),
    totalWorkouts: z.number().int(),
    workoutsPerWeek: z.number().int(),
    cycleLength: z.number().int(),
  })
  .passthrough()
  .readonly();
const previewCatalog_Body = z
  .object({
    definition: z.object({}).partial().passthrough().readonly(),
    config: z.object({}).partial().passthrough().readonly(),
  })
  .passthrough()
  .readonly();
const ExerciseEntry = z
  .object({
    id: z.string(),
    name: z.string(),
    muscleGroupId: z.string(),
    equipment: z.string().nullable(),
    isCompound: z.boolean(),
    isPreset: z.boolean(),
    createdBy: z.string().nullable(),
    force: z.string().nullable(),
    level: z.string().nullable(),
    mechanic: z.string().nullable(),
    category: z.string().nullable(),
    secondaryMuscles: z.array(z.string()).readonly(),
  })
  .passthrough()
  .readonly();
const ExerciseListResponse = z
  .object({
    data: z.array(ExerciseEntry).readonly(),
    total: z.number().int(),
    offset: z.number().int(),
    limit: z.number().int(),
  })
  .passthrough()
  .readonly();
const createExercise_Body = z
  .object({
    name: z.string(),
    muscleGroupId: z.string(),
    equipment: z.string().optional(),
    isCompound: z.boolean().nullish(),
  })
  .passthrough()
  .readonly();
const MuscleGroupEntry = z.object({ id: z.string(), name: z.string() }).passthrough().readonly();
const ProgramDefinitionResponse = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    definition: z.object({}).partial().passthrough().readonly(),
    status: z.enum(['draft', 'pending_review', 'approved', 'rejected']),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    deletedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .passthrough()
  .readonly();
const ProgramDefinitionListResponse = z
  .object({ data: z.array(ProgramDefinitionResponse).readonly(), total: z.number().int() })
  .passthrough()
  .readonly();
const forkDefinition_Body = z
  .object({ sourceId: z.string(), sourceType: z.string() })
  .passthrough()
  .readonly();
const updateDefinitionStatus_Body = z
  .object({ status: z.enum(['draft', 'pending_review', 'approved', 'rejected']) })
  .passthrough()
  .readonly();
const StatsOnlineResponse = z
  .object({ count: z.number().int().nullable() })
  .passthrough()
  .readonly();

export const schemas = {
  HealthResponse,
  Error,
  UserResponse,
  AuthResponse,
  RefreshResponse,
  updateMe_Body,
  ProgramInstanceListItem,
  ProgramListResponse,
  createProgram_Body,
  ProgramInstanceResponse,
  updateProgram_Body,
  recordResult_Body,
  UndoResponse,
  CatalogEntry,
  previewCatalog_Body,
  ExerciseEntry,
  ExerciseListResponse,
  createExercise_Body,
  MuscleGroupEntry,
  ProgramDefinitionResponse,
  ProgramDefinitionListResponse,
  forkDefinition_Body,
  updateDefinitionStatus_Body,
  StatsOnlineResponse,
};
