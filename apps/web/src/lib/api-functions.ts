/**
 * API functions wrapping fetch calls with auth retry.
 *
 * All consumers work with slot-keyed generic format.
 */
import { getAccessToken, refreshAccessToken } from './api';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import type { ResultValue, SetLogEntry, GenericWorkoutRow } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericResults, GenericUndoHistory } from '@gzclp/shared/types/program';
import { isRecord } from '@gzclp/shared/type-guards';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';
import { z } from 'zod/v4';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Response types (what our API functions return to consumers)
// ---------------------------------------------------------------------------

export interface ProgramSummary {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: Record<string, number | string>;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GenericProgramDetail {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: Record<string, number | string>;
  readonly metadata: unknown;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly completedDates: Readonly<Record<string, string>>;
  readonly definitionId: string | null;
  readonly customDefinition: unknown | null;
  readonly status: string;
}

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
      signal: options.signal ?? AbortSignal.timeout(30_000),
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

function parseMixedConfigRecord(value: unknown): Record<string, number | string> {
  if (!isRecord(value)) return {};
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function parseSummary(rec: unknown): ProgramSummary {
  if (!isRecord(rec)) throw new Error('Invalid program response');
  return {
    id: String(rec.id ?? ''),
    programId: String(rec.programId ?? ''),
    name: String(rec.name ?? ''),
    config: parseMixedConfigRecord(rec.config),
    status: String(rec.status ?? 'active'),
    createdAt: String(rec.createdAt ?? ''),
    updatedAt: String(rec.updatedAt ?? ''),
  };
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/** Fetch all program instances for the current user (first page). */
export async function fetchPrograms(): Promise<ProgramSummary[]> {
  const data = await apiFetch('/programs');
  // Handle both legacy array response and new paginated { data, nextCursor } shape
  if (Array.isArray(data)) return data.map(parseSummary);
  if (isRecord(data) && Array.isArray(data.data)) return data.data.map(parseSummary);
  return [];
}

// ---------------------------------------------------------------------------
// Shared result / undo parsers (used by both legacy and generic fetch)
// ---------------------------------------------------------------------------

function parseSetLogs(raw: unknown): SetLogEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const logs: SetLogEntry[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.reps !== 'number') continue;
    logs.push({
      reps: entry.reps,
      ...(typeof entry.weight === 'number' ? { weight: entry.weight } : {}),
      ...(typeof entry.rpe === 'number' ? { rpe: entry.rpe } : {}),
    });
  }
  return logs.length > 0 ? logs : undefined;
}

function parseGenericResults(raw: unknown): GenericResults {
  if (!isRecord(raw)) return {};
  const results: GenericResults = {};
  for (const [indexStr, slots] of Object.entries(raw)) {
    if (!isRecord(slots)) continue;
    const slotMap: Record<
      string,
      {
        result?: 'success' | 'fail';
        amrapReps?: number;
        rpe?: number;
        setLogs?: SetLogEntry[];
      }
    > = {};
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!isRecord(slotData)) continue;
      const parsedSetLogs = parseSetLogs(slotData.setLogs);
      slotMap[slotId] = {
        ...(slotData.result === 'success' || slotData.result === 'fail'
          ? { result: slotData.result }
          : {}),
        ...(typeof slotData.amrapReps === 'number' ? { amrapReps: slotData.amrapReps } : {}),
        ...(typeof slotData.rpe === 'number' ? { rpe: slotData.rpe } : {}),
        ...(parsedSetLogs !== undefined ? { setLogs: parsedSetLogs } : {}),
      };
    }
    results[indexStr] = slotMap;
  }
  return results;
}

function isValidUndoEntry(
  entry: Record<string, unknown>
): entry is Record<string, unknown> & { i: number; slotId: string } {
  return typeof entry.i === 'number' && typeof entry.slotId === 'string';
}

function parseGenericUndoHistory(raw: unknown): GenericUndoHistory {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter(isValidUndoEntry)
    .map((entry) => ({
      i: entry.i,
      slotId: entry.slotId,
      ...(entry.prev === 'success' || entry.prev === 'fail' ? { prev: entry.prev } : {}),
    }));
}

/** Create a new program instance. */
export async function createProgram(
  programId: string,
  name: string,
  config: Record<string, number | string>
): Promise<ProgramSummary> {
  const data = await apiFetch('/programs', {
    method: 'POST',
    body: JSON.stringify({ programId, name, config: { ...config } }),
  });
  return parseSummary(data);
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
): Promise<GenericProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ metadata }),
  });
  if (!isRecord(data)) throw new Error('Invalid metadata response');
  return {
    id: String(data.id ?? ''),
    programId: String(data.programId ?? ''),
    name: String(data.name ?? ''),
    config: parseMixedConfigRecord(data.config),
    metadata: data.metadata ?? null,
    results: parseGenericResults(data.results),
    undoHistory: parseGenericUndoHistory(data.undoHistory),
    resultTimestamps: parseStringRecord(data.resultTimestamps),
    completedDates: parseStringRecord(data.completedDates),
    definitionId: typeof data.definitionId === 'string' ? data.definitionId : null,
    customDefinition: data.customDefinition ?? null,
    status: String(data.status ?? 'active'),
  };
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

/** Import a program from exported JSON. */
export async function importProgram(data: unknown): Promise<ProgramSummary> {
  const result = await apiFetch('/programs/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseSummary(result);
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

/** Update user profile (name and/or avatar). */
export async function updateProfile(fields: {
  name?: string;
  avatarUrl?: string | null;
}): Promise<{ id: string; email: string; name: string | null; avatarUrl: string | null }> {
  const data = await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  if (!isRecord(data)) throw new Error('Invalid profile response');
  return {
    id: String(data.id ?? ''),
    email: String(data.email ?? ''),
    name: typeof data.name === 'string' ? data.name : null,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
  };
}

/** Soft-delete the current user account. */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/auth/me', { method: 'DELETE' });
}

/** Fetch the count of users active in the last 60 seconds. Public endpoint — no auth required. */
export async function fetchOnlineCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/stats/online`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (isRecord(data) && typeof data.count === 'number') return data.count;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic API Functions (slot-keyed, no legacy conversion)
// ---------------------------------------------------------------------------

/** Fetch a program instance with results in generic slot-keyed format (no legacy conversion). */
export async function fetchGenericProgramDetail(id: string): Promise<GenericProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}`);
  if (!isRecord(data)) throw new Error('Invalid program response');

  return {
    id: String(data.id ?? ''),
    programId: String(data.programId ?? ''),
    name: String(data.name ?? ''),
    config: parseMixedConfigRecord(data.config),
    metadata: data.metadata ?? null,
    results: parseGenericResults(data.results),
    undoHistory: parseGenericUndoHistory(data.undoHistory),
    resultTimestamps: parseStringRecord(data.resultTimestamps),
    completedDates: parseStringRecord(data.completedDates),
    definitionId: typeof data.definitionId === 'string' ? data.definitionId : null,
    customDefinition: data.customDefinition ?? null,
    status: String(data.status ?? 'active'),
  };
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
// Catalog types (mirrors API service types)
// ---------------------------------------------------------------------------

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly level: ProgramLevel;
  readonly source: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly cycleLength: number;
}

export interface ExerciseEntry {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment: string | null;
  readonly isCompound: boolean;
  readonly isPreset: boolean;
  readonly createdBy: string | null;
  readonly force: string | null;
  readonly level: string | null;
  readonly mechanic: string | null;
  readonly category: string | null;
  readonly secondaryMuscles: readonly string[] | null;
}

export interface MuscleGroupEntry {
  readonly id: string;
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Catalog API functions (public, no auth required)
// ---------------------------------------------------------------------------

const VALID_LEVELS: ReadonlySet<string> = new Set(PROGRAM_LEVELS);

function isValidLevel(value: unknown): value is ProgramLevel {
  return typeof value === 'string' && VALID_LEVELS.has(value);
}

function parseCatalogEntry(raw: unknown): CatalogEntry {
  if (!isRecord(raw)) throw new Error('Invalid catalog entry');
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    author: String(raw.author ?? ''),
    category: String(raw.category ?? ''),
    level: isValidLevel(raw.level) ? raw.level : 'intermediate',
    source: String(raw.source ?? ''),
    totalWorkouts: typeof raw.totalWorkouts === 'number' ? raw.totalWorkouts : 0,
    workoutsPerWeek: typeof raw.workoutsPerWeek === 'number' ? raw.workoutsPerWeek : 0,
    cycleLength: typeof raw.cycleLength === 'number' ? raw.cycleLength : 0,
  };
}

/** Fetch the catalog list of all preset programs (no auth required). */
export async function fetchCatalogList(): Promise<readonly CatalogEntry[]> {
  const data = await apiFetch('/catalog');
  if (!Array.isArray(data)) return [];
  return data.map(parseCatalogEntry);
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
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Exercise API functions
// ---------------------------------------------------------------------------

function parseSecondaryMuscles(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') strings.push(item);
  }
  return strings.length > 0 ? strings : null;
}

/** Exported for testing — parses a raw API response object into a typed ExerciseEntry. */
export function parseExerciseEntry(raw: unknown): ExerciseEntry {
  if (!isRecord(raw)) throw new Error('Invalid exercise entry');
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    muscleGroupId: String(raw.muscleGroupId ?? ''),
    equipment: typeof raw.equipment === 'string' ? raw.equipment : null,
    isCompound: raw.isCompound === true,
    isPreset: raw.isPreset === true,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : null,
    force: typeof raw.force === 'string' ? raw.force : null,
    level: typeof raw.level === 'string' ? raw.level : null,
    mechanic: typeof raw.mechanic === 'string' ? raw.mechanic : null,
    category: typeof raw.category === 'string' ? raw.category : null,
    secondaryMuscles: parseSecondaryMuscles(raw.secondaryMuscles),
  };
}

function parseMuscleGroupEntry(raw: unknown): MuscleGroupEntry {
  if (!isRecord(raw)) throw new Error('Invalid muscle group entry');
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
  };
}

/** Zod schema for the paginated exercises API response (zod/v4). */
const PaginatedExercisesResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

/** Paginated exercises response from GET /exercises. */
export interface PaginatedExercisesResponse {
  readonly data: readonly ExerciseEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

/** Fetch exercises visible to the current user, with optional filtering. */
export async function fetchExercises(filter?: ExerciseFilter): Promise<PaginatedExercisesResponse> {
  const raw = await apiFetch(`/exercises${buildExerciseQueryString(filter)}`);
  const parsed = PaginatedExercisesResponseSchema.parse(raw);
  return {
    data: parsed.data.map(parseExerciseEntry),
    total: parsed.total,
    offset: parsed.offset,
    limit: parsed.limit,
  };
}

/** Fetch all muscle groups (no auth required). */
export async function fetchMuscleGroups(): Promise<readonly MuscleGroupEntry[]> {
  const data = await apiFetch('/muscle-groups');
  if (!Array.isArray(data)) return [];
  return data.map(parseMuscleGroupEntry);
}

// ---------------------------------------------------------------------------
// Program Definitions (user-created custom programs)
// ---------------------------------------------------------------------------

export interface ProgramDefinitionResponse {
  readonly id: string;
  readonly userId: string;
  readonly definition: unknown;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

function parseDefinitionResponse(raw: unknown): ProgramDefinitionResponse {
  if (!isRecord(raw)) throw new Error('Invalid program definition response');
  return {
    id: String(raw.id ?? ''),
    userId: String(raw.userId ?? ''),
    definition: raw.definition ?? null,
    status: String(raw.status ?? 'draft'),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
  };
}

/** Fork a program definition from a template or existing definition. */
export async function forkDefinition(
  sourceId: string,
  sourceType: 'template' | 'definition'
): Promise<ProgramDefinitionResponse> {
  const data = await apiFetch('/program-definitions/fork', {
    method: 'POST',
    body: JSON.stringify({ sourceId, sourceType }),
  });
  return parseDefinitionResponse(data);
}

/** Fetch user's program definitions with pagination. */
export async function fetchDefinitions(
  offset?: number,
  limit?: number
): Promise<{ readonly data: readonly ProgramDefinitionResponse[]; readonly total: number }> {
  const params = new URLSearchParams();
  if (offset !== undefined) params.set('offset', String(offset));
  if (limit !== undefined) params.set('limit', String(limit));
  const qs = params.toString();
  const data = await apiFetch(`/program-definitions${qs ? `?${qs}` : ''}`);
  if (!isRecord(data)) throw new Error('Invalid definitions response');
  const rawData = Array.isArray(data.data) ? data.data : [];
  return {
    data: rawData.map(parseDefinitionResponse),
    total: typeof data.total === 'number' ? data.total : 0,
  };
}

/** Fetch a single program definition by ID. */
export async function fetchDefinition(id: string): Promise<ProgramDefinitionResponse> {
  const data = await apiFetch(`/program-definitions/${encodeURIComponent(id)}`);
  return parseDefinitionResponse(data);
}

/** Update a program definition. */
export async function updateDefinition(
  id: string,
  payload: unknown
): Promise<ProgramDefinitionResponse> {
  const data = await apiFetch(`/program-definitions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ definition: payload }),
  });
  return parseDefinitionResponse(data);
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
  return parsePreviewRows(data);
}

function parsePreviewRows(raw: readonly unknown[]): readonly GenericWorkoutRow[] {
  // The API returns GenericWorkoutRow[] — validate shape minimally
  return raw.filter(isRecord).map(
    (row): GenericWorkoutRow => ({
      index: typeof row.index === 'number' ? row.index : 0,
      dayName: typeof row.dayName === 'string' ? row.dayName : '',
      slots: Array.isArray(row.slots) ? row.slots.filter(isRecord).map(parseSlotRow) : [],
      isChanged: row.isChanged === true,
      completedAt: typeof row.completedAt === 'string' ? row.completedAt : undefined,
    })
  );
}

function parseSlotRow(raw: Record<string, unknown>): GenericWorkoutRow['slots'][number] {
  return {
    slotId: String(raw.slotId ?? ''),
    exerciseId: String(raw.exerciseId ?? ''),
    exerciseName: String(raw.exerciseName ?? ''),
    tier: String(raw.tier ?? ''),
    weight: typeof raw.weight === 'number' ? raw.weight : 0,
    stage: typeof raw.stage === 'number' ? raw.stage : 0,
    sets: typeof raw.sets === 'number' ? raw.sets : 0,
    reps: typeof raw.reps === 'number' ? raw.reps : 0,
    repsMax: typeof raw.repsMax === 'number' ? raw.repsMax : undefined,
    isAmrap: raw.isAmrap === true,
    stagesCount: typeof raw.stagesCount === 'number' ? raw.stagesCount : 1,
    result: raw.result === 'success' || raw.result === 'fail' ? raw.result : undefined,
    amrapReps: typeof raw.amrapReps === 'number' ? raw.amrapReps : undefined,
    rpe: typeof raw.rpe === 'number' ? raw.rpe : undefined,
    isChanged: raw.isChanged === true,
    isDeload: raw.isDeload === true,
    role:
      raw.role === 'primary' || raw.role === 'secondary' || raw.role === 'accessory'
        ? raw.role
        : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    prescriptions: undefined,
    isGpp: raw.isGpp === true ? true : undefined,
    complexReps: typeof raw.complexReps === 'string' ? raw.complexReps : undefined,
    propagatesTo: typeof raw.propagatesTo === 'string' ? raw.propagatesTo : undefined,
    isTestSlot: raw.isTestSlot === true ? true : undefined,
    isBodyweight: raw.isBodyweight === true ? true : undefined,
    setLogs: undefined,
  };
}

/** Create a program instance from a custom definition. */
export async function createCustomProgram(
  definitionId: string,
  name: string,
  config: Record<string, number | string>
): Promise<ProgramSummary> {
  const data = await apiFetch('/programs', {
    method: 'POST',
    body: JSON.stringify({
      definitionId,
      name,
      config: { ...config },
    }),
  });
  return parseSummary(data);
}
