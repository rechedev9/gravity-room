/**
 * API functions wrapping fetch calls with auth retry.
 *
 * All consumers work with slot-keyed generic format.
 */
import { getAccessToken, refreshAccessToken } from './api';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { GenericProgramDetailSchema } from '@gzclp/shared/schemas/instance';
import { ProgramSummarySchema } from '@gzclp/shared/schemas/program-summary';
import { CatalogEntrySchema } from '@gzclp/shared/schemas/catalog';
import {
  ExerciseEntrySchema,
  MuscleGroupEntrySchema,
  PaginatedExercisesResponseSchema,
} from '@gzclp/shared/schemas/exercises';
import {
  ProgramDefinitionResponseSchema,
  ProgramDefinitionListResponseSchema,
} from '@gzclp/shared/schemas/program-definition-response';
import { InsightItemSchema } from '@gzclp/shared/schemas/insights';
import { GenericWorkoutRowSchema } from '@gzclp/shared/schemas/workout-rows';
import { UserResponseSchema, parseUserSafe } from '@gzclp/shared/schemas/user';
import type { ResultValue, SetLogEntry, GenericWorkoutRow } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { isRecord } from '@gzclp/shared/type-guards';
import { z } from 'zod/v4';

// Re-export types derived from schemas
export type { UserInfo } from '@gzclp/shared/schemas/user';
export type { ProgramSummary } from '@gzclp/shared/schemas/program-summary';
export type { CatalogEntry } from '@gzclp/shared/schemas/catalog';
export type {
  ExerciseEntry,
  MuscleGroupEntry,
  PaginatedExercisesResponse,
} from '@gzclp/shared/schemas/exercises';
export type { ProgramDefinitionResponse } from '@gzclp/shared/schemas/program-definition-response';
export type { InsightItem } from '@gzclp/shared/schemas/insights';
export type { GenericProgramDetail } from '@gzclp/shared/schemas/instance';

// Re-export helpers from user schema
export { parseUserSafe };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Auth-aware fetch wrapper with automatic retry on 401
// ---------------------------------------------------------------------------

function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined
): Record<string, string> {
  if (!extra) return base;
  if (extra instanceof Headers) {
    const merged = { ...base };
    extra.forEach((value, key) => {
      merged[key] = value;
    });
    return merged;
  }
  if (Array.isArray(extra)) {
    const merged = { ...base };
    for (const [key, value] of extra) {
      merged[key] = value;
    }
    return merged;
  }
  return { ...base, ...extra };
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const body: unknown = await res.json().catch(() => ({}));
  if (isRecord(body) && typeof body.error === 'string') {
    // Include the machine-readable error code (if present) so callers can match on it
    if (typeof body.code === 'string') return `${body.error} [${body.code}]`;
    return body.error;
  }
  return fallback;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const doFetch = (): Promise<Response> =>
    fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: mergeHeaders(headers, options.headers),
      credentials: 'include',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });

  const res = await doFetch();

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      const retry = await doFetch();
      if (!retry.ok)
        throw new Error(await extractErrorMessage(retry, `API error: ${retry.status}`));
      if (retry.status === 204) return null;
      return retry.json();
    }

    throw new Error(await extractErrorMessage(res, 'Authentication failed'));
  }

  if (!res.ok) throw new Error(await extractErrorMessage(res, `API error: ${res.status}`));
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/** Fetch all program instances for the current user (first page). */
export async function fetchPrograms(): Promise<
  import('@gzclp/shared/schemas/program-summary').ProgramSummary[]
> {
  const data = await apiFetch('/programs');
  // Handle both legacy array response and new paginated { data, nextCursor } shape
  if (Array.isArray(data)) return data.map((item) => ProgramSummarySchema.parse(item));
  if (isRecord(data) && Array.isArray(data.data))
    return data.data.map((item) => ProgramSummarySchema.parse(item));
  return [];
}

/** Create a new program instance. */
export async function createProgram(
  programId: string,
  name: string,
  config: Record<string, number | string>
): Promise<import('@gzclp/shared/schemas/program-summary').ProgramSummary> {
  const data = await apiFetch('/programs', {
    method: 'POST',
    body: JSON.stringify({ programId, name, config: { ...config } }),
  });
  return ProgramSummarySchema.parse(data);
}

/** Update a program instance's config (e.g., start weights). */
export async function updateProgramConfig(
  id: string,
  config: Record<string, number | string>
): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ config: { ...config } }),
  });
}

/** Update a program instance's metadata (deep-merge on server). */
export async function updateProgramMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<import('@gzclp/shared/schemas/instance').GenericProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ metadata }),
  });
  return GenericProgramDetailSchema.parse(data);
}

/** Mark a program instance as completed (preserves all data). */
export async function completeProgram(id: string): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
}

/** Delete a program instance. */
export async function deleteProgram(id: string): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Undo the last action. */
export async function undoLastResult(instanceId: string): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(instanceId)}/undo`, {
    method: 'POST',
  });
}

/** Export a program instance as JSON. */
export async function exportProgram(id: string): Promise<unknown> {
  return apiFetch(`/programs/${encodeURIComponent(id)}/export`);
}

const ImportPayloadSchema = z.object({
  version: z.literal(1),
  programId: z.string().min(1),
  name: z.string().min(1).max(100),
});

/** Import a program from exported JSON. Throws a ZodError if the payload is invalid. */
export async function importProgram(
  data: unknown
): Promise<import('@gzclp/shared/schemas/program-summary').ProgramSummary> {
  ImportPayloadSchema.parse(data);
  const result = await apiFetch('/programs/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return ProgramSummarySchema.parse(result);
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

/** Fetch the authenticated user's profile. */
export async function fetchMe(): Promise<import('@gzclp/shared/schemas/user').UserInfo> {
  const data = await apiFetch('/auth/me');
  return UserResponseSchema.parse(data);
}

/** Update user profile (name and/or avatar). */
export async function updateProfile(fields: {
  name?: string;
  avatarUrl?: string | null;
}): Promise<import('@gzclp/shared/schemas/user').UserInfo> {
  const data = await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return UserResponseSchema.parse(data);
}

/** Soft-delete the current user account. */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/auth/me', { method: 'DELETE' });
}

const StatsOnlineResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

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

// ---------------------------------------------------------------------------
// Generic API Functions (slot-keyed, no legacy conversion)
// ---------------------------------------------------------------------------

/** Fetch a program instance with results in generic slot-keyed format (no legacy conversion). */
export async function fetchGenericProgramDetail(
  id: string
): Promise<import('@gzclp/shared/schemas/instance').GenericProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}`);
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
  await apiFetch(`/programs/${encodeURIComponent(instanceId)}/results`, {
    method: 'POST',
    body: JSON.stringify({
      workoutIndex,
      slotId,
      result,
      ...(amrapReps !== undefined ? { amrapReps } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
      ...(setLogs !== undefined ? { setLogs } : {}),
    }),
  });
}

/** Delete a specific result using slot ID directly (no tier conversion). */
export async function deleteGenericResult(
  instanceId: string,
  workoutIndex: number,
  slotId: string
): Promise<void> {
  await apiFetch(
    `/programs/${encodeURIComponent(instanceId)}/results/${workoutIndex}/${encodeURIComponent(slotId)}`,
    { method: 'DELETE' }
  );
}

// ---------------------------------------------------------------------------
// Catalog API functions (public, no auth required)
// ---------------------------------------------------------------------------

/** Fetch the catalog list of all preset programs (no auth required). */
export async function fetchCatalogList(): Promise<
  readonly import('@gzclp/shared/schemas/catalog').CatalogEntry[]
> {
  const data = await apiFetch('/catalog');
  if (!Array.isArray(data)) return [];
  return data.map((item) => CatalogEntrySchema.parse(item));
}

/** Fetch a full hydrated ProgramDefinition by program ID (no auth required). */
export async function fetchCatalogDetail(programId: string): Promise<ProgramDefinition> {
  const data = await apiFetch(`/catalog/${encodeURIComponent(programId)}`);
  // Client-side validation with the same schema the API uses
  return ProgramDefinitionSchema.parse(data);
}

// ---------------------------------------------------------------------------
// Exercise filter types + helpers
// ---------------------------------------------------------------------------

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
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Exercise API functions
// ---------------------------------------------------------------------------

/** Exported for testing — parses a raw API response object into a typed ExerciseEntry. */
export function parseExerciseEntry(
  raw: unknown
): import('@gzclp/shared/schemas/exercises').ExerciseEntry {
  return ExerciseEntrySchema.parse(raw);
}

/** Fetch exercises visible to the current user, with optional filtering. */
export async function fetchExercises(
  filter?: ExerciseFilter
): Promise<import('@gzclp/shared/schemas/exercises').PaginatedExercisesResponse> {
  const raw = await apiFetch(`/exercises${buildExerciseQueryString(filter)}`);
  const parsed = PaginatedExercisesResponseSchema.parse(raw);
  return {
    data: parsed.data.map((item) => ExerciseEntrySchema.parse(item)),
    total: parsed.total,
    offset: parsed.offset,
    limit: parsed.limit,
  };
}

/** Fetch all muscle groups (no auth required). */
export async function fetchMuscleGroups(): Promise<
  readonly import('@gzclp/shared/schemas/exercises').MuscleGroupEntry[]
> {
  const data = await apiFetch('/muscle-groups');
  if (!Array.isArray(data)) return [];
  return data.map((item) => MuscleGroupEntrySchema.parse(item));
}

// ---------------------------------------------------------------------------
// Program Definitions (user-created custom programs)
// ---------------------------------------------------------------------------

/** Fork a program definition from a template or existing definition. */
export async function forkDefinition(
  sourceId: string,
  sourceType: 'template' | 'definition'
): Promise<import('@gzclp/shared/schemas/program-definition-response').ProgramDefinitionResponse> {
  const data = await apiFetch('/program-definitions/fork', {
    method: 'POST',
    body: JSON.stringify({ sourceId, sourceType }),
  });
  return ProgramDefinitionResponseSchema.parse(data);
}

/** Fetch user's program definitions with pagination. */
export async function fetchDefinitions(
  offset?: number,
  limit?: number
): Promise<{
  readonly data: readonly import('@gzclp/shared/schemas/program-definition-response').ProgramDefinitionResponse[];
  readonly total: number;
}> {
  const params = new URLSearchParams();
  if (offset !== undefined) params.set('offset', String(offset));
  if (limit !== undefined) params.set('limit', String(limit));
  const qs = params.toString();
  const data = await apiFetch(`/program-definitions${qs ? `?${qs}` : ''}`);
  const parsed = ProgramDefinitionListResponseSchema.parse(data);
  return { data: parsed.data, total: parsed.total };
}

/** Fetch a single program definition by ID. */
export async function fetchDefinition(
  id: string
): Promise<import('@gzclp/shared/schemas/program-definition-response').ProgramDefinitionResponse> {
  const data = await apiFetch(`/program-definitions/${encodeURIComponent(id)}`);
  return ProgramDefinitionResponseSchema.parse(data);
}

/** Update a program definition. */
export async function updateDefinition(
  id: string,
  payload: unknown
): Promise<import('@gzclp/shared/schemas/program-definition-response').ProgramDefinitionResponse> {
  const data = await apiFetch(`/program-definitions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ definition: payload }),
  });
  return ProgramDefinitionResponseSchema.parse(data);
}

/** Delete (soft) a program definition. */
export async function deleteDefinition(id: string): Promise<void> {
  await apiFetch(`/program-definitions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Preview a program definition (dry-run, no save). */
export async function previewDefinition(
  definition: ProgramDefinition,
  config?: Record<string, number | string>
): Promise<readonly GenericWorkoutRow[]> {
  const body: Record<string, unknown> = { definition };
  if (config) {
    body['config'] = config;
  }
  const data = await apiFetch('/catalog/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!Array.isArray(data)) {
    throw new Error('Error al generar la vista previa');
  }
  return data.map((item) => GenericWorkoutRowSchema.parse(item));
}

/** Create a program instance from a custom definition. */
export async function createCustomProgram(
  definitionId: string,
  name: string,
  config: Record<string, number | string>
): Promise<import('@gzclp/shared/schemas/program-summary').ProgramSummary> {
  const data = await apiFetch('/programs', {
    method: 'POST',
    body: JSON.stringify({
      definitionId,
      name,
      config: { ...config },
    }),
  });
  return ProgramSummarySchema.parse(data);
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

/** Fetch pre-computed insights for the current user. */
export async function fetchInsights(
  types?: string[]
): Promise<import('@gzclp/shared/schemas/insights').InsightItem[]> {
  const query = types?.length ? `?types=${types.join(',')}` : '';
  const data = await apiFetch(`/insights${query}`);
  if (isRecord(data) && Array.isArray(data.data))
    return data.data.map((item) => InsightItemSchema.parse(item));
  return [];
}
