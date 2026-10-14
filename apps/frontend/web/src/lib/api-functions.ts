/**
 * API functions wrapping fetch calls with auth retry.
 *
 * All consumers work with slot-keyed generic format.
 */
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { GenericProgramDetailSchema } from '@gzclp/domain/schemas/instance';
import { ProgramListPageSchema, ProgramSummarySchema } from '@gzclp/domain/schemas/program-summary';
import { CatalogEntrySchema } from '@gzclp/domain/schemas/catalog';
import { ExerciseEntrySchema, MuscleGroupEntrySchema } from '@gzclp/domain/schemas/exercises';
import { InsightItemSchema } from '@gzclp/domain/schemas/insights';
import { parseUserSafe } from '@gzclp/domain/schemas/user';
import type { ResultValue, SetLogEntry } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { ProgramSummary } from '@gzclp/domain/schemas/program-summary';
import type { GenericProgramDetail } from '@gzclp/domain/schemas/instance';
import type { CatalogEntry } from '@gzclp/domain/schemas/catalog';
import type {
  ExerciseEntry,
  MuscleGroupEntry,
  PaginatedExercisesResponse,
} from '@gzclp/domain/schemas/exercises';
import type { InsightItem } from '@gzclp/domain/schemas/insights';
import { isRecord } from '@gzclp/domain/type-guards';
import { MAX_PROGRAM_LIST_PAGES } from '@gzclp/domain/program-list';
import { collectCursorPages } from '@gzclp/api-client/cursor-pages';
import * as requests from '@gzclp/api-client/program-requests';
import { readApiError } from '@gzclp/api-client/response-error';
import { z } from 'zod/v4';
import { API_URL } from './api';
import { apiFetch, deleteAccount, fetchMe, updateProfile, type ApiFetchOptions } from './api-core';

// Re-export types derived from schemas
export type { UserInfo } from '@gzclp/domain/schemas/user';
export type { ProgramSummary } from '@gzclp/domain/schemas/program-summary';
export type { CatalogEntry } from '@gzclp/domain/schemas/catalog';
export type {
  ExerciseEntry,
  MuscleGroupEntry,
  PaginatedExercisesResponse,
} from '@gzclp/domain/schemas/exercises';
export type { InsightItem } from '@gzclp/domain/schemas/insights';
export type { GenericProgramDetail } from '@gzclp/domain/schemas/instance';

// Re-export helpers from user schema
export { parseUserSafe };

// Re-export the core fetch/profile surface (see api-core.ts for why it is split).
export { apiFetch, fetchMe, updateProfile, deleteAccount };
export type { ApiFetchOptions };


function send(request: requests.ApiRequest): Promise<unknown> {
  return apiFetch(request.path, requests.toRequestInit(request));
}

export async function fetchPrograms(): Promise<ProgramSummary[]> {
  return collectCursorPages({
    maxPages: MAX_PROGRAM_LIST_PAGES,
    fetchPage: async (cursor) => {
      const data = await send(requests.listPrograms(cursor));
      return ProgramListPageSchema.parse(data);
    },
  });
}

/** Create a new program instance. */
export async function createProgram(
  programId: string,
  name: string,
  config: Record<string, number | string>
): Promise<ProgramSummary> {
  const data = await send(requests.createProgram({ programId, name, config }));
  return ProgramSummarySchema.parse(data);
}

/** Update a program instance's config (e.g., start weights). */
export async function updateProgramConfig(
  id: string,
  config: Record<string, number | string>
): Promise<void> {
  await send(requests.updateProgramConfig(id, config));
}

/** Update a program instance's metadata (deep-merge on server). */
export async function updateProgramMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<GenericProgramDetail> {
  const data = await send(requests.updateMetadata(id, metadata));
  return GenericProgramDetailSchema.parse(data);
}

/** Mark a program instance as completed (preserves all data). */
export async function completeProgram(id: string): Promise<void> {
  await send(requests.completeProgram(id));
}

/** Delete a program instance. */
export async function deleteProgram(id: string): Promise<void> {
  await send(requests.deleteProgram(id));
}

/** Undo the last action. */
export async function undoLastResult(instanceId: string): Promise<void> {
  await send(requests.undoLastResult(instanceId));
}

/** Export a program instance as JSON. */
export async function exportProgram(id: string): Promise<unknown> {
  return send(requests.exportProgram(id));
}

const ImportPayloadSchema = z.object({
  version: z.literal(1),
  programId: z.string().min(1),
  name: z.string().min(1).max(100),
});

/** Import a program from exported JSON. Throws a ZodError if the payload is invalid. */
export async function importProgram(data: unknown): Promise<ProgramSummary> {
  ImportPayloadSchema.parse(data);
  const result = await send(requests.importProgram(data));
  return ProgramSummarySchema.parse(result);
}

const StatsOnlineResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

const AuthProvidersResponseSchema = z.object({
  emailPassword: z.boolean(),
  google: z.boolean(),
  apple: z.boolean(),
  github: z.boolean(),
  microsoft: z.boolean(),
});

export type AuthProviders = z.infer<typeof AuthProvidersResponseSchema>;

/** Fetch public auth provider availability for the current deployment. Public
 * endpoint — a direct fetch (no auth header, no 401 refresh round-trip). */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  const res = await fetch(`${API_URL}/api/auth/providers`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await readApiError(res, `API error: ${res.status}`);
  return AuthProvidersResponseSchema.parse(await res.json());
}

/** Fetch the count of users active in the last 60 seconds. Public endpoint — no auth required. */
export async function fetchOnlineCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/stats/online`);
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = StatsOnlineResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.count : null;
  } catch {
    return null;
  }
}


/** Fetch a program instance with results in generic slot-keyed format (no legacy conversion). */
export async function fetchGenericProgramDetail(id: string): Promise<GenericProgramDetail> {
  const data = await send(requests.programDetail(id));
  return GenericProgramDetailSchema.parse(data);
}

/** Record a workout result using slot ID directly (no tier conversion). */
export async function recordGenericResult(
  instanceId: string,
  workoutIndex: number,
  slotId: string,
  result: ResultValue,
  amrapReps?: number,
  rpe?: number,
  setLogs?: readonly SetLogEntry[]
): Promise<void> {
  await send(
    requests.recordResult({ instanceId, workoutIndex, slotId, result, amrapReps, rpe, setLogs })
  );
}

/** Delete a specific result using slot ID directly (no tier conversion). */
export async function deleteGenericResult(
  instanceId: string,
  workoutIndex: number,
  slotId: string
): Promise<void> {
  await send(requests.deleteResult({ instanceId, workoutIndex, slotId }));
}


const CatalogEntryListSchema = z.array(CatalogEntrySchema);

/** Fetch the catalog list of all preset programs (no auth required). */
export async function fetchCatalogList(): Promise<readonly CatalogEntry[]> {
  const data = await send(requests.catalogList());
  if (!Array.isArray(data)) return [];
  return CatalogEntryListSchema.parse(data);
}

/** Fetch a full hydrated ProgramDefinition by program ID (no auth required). */
export async function fetchCatalogDetail(programId: string): Promise<ProgramDefinition> {
  const data = await send(requests.catalogDetail(programId));
  // Client-side validation with the same schema the API uses
  return ProgramDefinitionSchema.parse(data);
}


export interface ExerciseFilter {
  readonly q?: string;
  readonly muscleGroupId?: readonly string[];
  readonly equipment?: readonly string[];
  readonly force?: readonly string[];
  readonly level?: readonly string[];
  readonly mechanic?: readonly string[];
  readonly category?: readonly string[];
  readonly isCompound?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

function buildExerciseQueryString(filter?: ExerciseFilter): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.muscleGroupId?.length) params.set('muscleGroupId', filter.muscleGroupId.join(','));
  if (filter.equipment?.length) params.set('equipment', filter.equipment.join(','));
  if (filter.force?.length) params.set('force', filter.force.join(','));
  if (filter.level?.length) params.set('level', filter.level.join(','));
  if (filter.mechanic?.length) params.set('mechanic', filter.mechanic.join(','));
  if (filter.category?.length) params.set('category', filter.category.join(','));
  if (filter.isCompound !== undefined) params.set('isCompound', String(filter.isCompound));
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}


/** Exported for testing — parses a raw API response object into a typed ExerciseEntry. */
export function parseExerciseEntry(raw: unknown): ExerciseEntry {
  return ExerciseEntrySchema.parse(raw);
}

const PaginatedExercisesClientSchema = z.object({
  data: z.array(ExerciseEntrySchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
});

const MuscleGroupEntryListSchema = z.array(MuscleGroupEntrySchema);
const InsightItemListSchema = z.array(InsightItemSchema);

/** Fetch exercises visible to the current user, with optional filtering. */
export async function fetchExercises(filter?: ExerciseFilter): Promise<PaginatedExercisesResponse> {
  const raw = await apiFetch(`/exercises${buildExerciseQueryString(filter)}`);
  // Single-pass array parse (avoids N× ExerciseEntrySchema.parse after the envelope).
  return PaginatedExercisesClientSchema.parse(raw);
}

/** Fetch all muscle groups (no auth required). */
export async function fetchMuscleGroups(): Promise<readonly MuscleGroupEntry[]> {
  const data = await apiFetch('/muscle-groups');
  if (!Array.isArray(data)) return [];
  return MuscleGroupEntryListSchema.parse(data);
}


/** Fetch pre-computed insights for the current user. */
export async function fetchInsights(types?: string[]): Promise<InsightItem[]> {
  const query = types?.length ? `?types=${types.join(',')}` : '';
  const data = await apiFetch(`/insights${query}`);
  if (isRecord(data) && Array.isArray(data.data)) return InsightItemListSchema.parse(data.data);
  return [];
}
