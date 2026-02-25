/**
 * API functions wrapping fetch calls with auth retry.
 *
 * All format conversion (tier-keyed ↔ slot-keyed) happens here at the boundary.
 * Consumers (useProgram, components) always work with legacy tier-keyed format.
 *
 * Uses direct fetch instead of Eden Treaty to avoid type inference issues with
 * complex Elysia apps. The typed abstraction layer here gives us the same safety.
 */
import { getAccessToken, refreshAccessToken } from './api';
import { convertResultsToLegacy, convertUndoToLegacy } from './migrations/v3-to-v1';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import type { StartWeights, Results, UndoHistory, Tier, ResultValue } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericResults, GenericUndoHistory } from '@gzclp/shared/types/program';
import { isRecord } from '@gzclp/shared/type-guards';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Response types (what our API functions return to consumers)
// ---------------------------------------------------------------------------

export interface ProgramSummary {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: Record<string, number>;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProgramDetail extends ProgramSummary {
  readonly startWeights: StartWeights;
  readonly results: Results;
  readonly undoHistory: UndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
}

export interface GenericProgramDetail {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: Record<string, number>;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly status: string;
}

// ---------------------------------------------------------------------------
// Slot ↔ Tier lookup (GZCLP-specific, inlined to avoid importing gzclp.ts)
// ---------------------------------------------------------------------------

/** GZCLP day-slot map. Inlined for legacy tier-to-slot conversion. */
const GZCLP_DAY_SLOT_MAP: Readonly<Record<number, Readonly<Record<string, string>>>> = {
  0: { t1: 'd1-t1', t2: 'd1-t2', t3: 'latpulldown-t3' },
  1: { t1: 'd2-t1', t2: 'd2-t2', t3: 'dbrow-t3' },
  2: { t1: 'd3-t1', t2: 'd3-t2', t3: 'latpulldown-t3' },
  3: { t1: 'd4-t1', t2: 'd4-t2', t3: 'dbrow-t3' },
};

const GZCLP_CYCLE_LENGTH = 4;

/** Convert a tier + workout index to a slot ID. */
export function tierToSlotId(workoutIndex: number, tier: Tier): string | null {
  const dayIndex = workoutIndex % GZCLP_CYCLE_LENGTH;
  return GZCLP_DAY_SLOT_MAP[dayIndex]?.[tier] ?? null;
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
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  return fallback;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const doFetch = (): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: mergeHeaders(headers, options.headers),
      credentials: 'include',
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
// Helper: parse config as StartWeights
// ---------------------------------------------------------------------------

function parseConfig(config: unknown): StartWeights {
  if (!isRecord(config)) {
    return { squat: 20, bench: 20, deadlift: 20, ohp: 20, latpulldown: 20, dbrow: 20 };
  }
  return {
    squat: typeof config.squat === 'number' ? config.squat : 20,
    bench: typeof config.bench === 'number' ? config.bench : 20,
    deadlift: typeof config.deadlift === 'number' ? config.deadlift : 20,
    ohp: typeof config.ohp === 'number' ? config.ohp : 20,
    latpulldown: typeof config.latpulldown === 'number' ? config.latpulldown : 20,
    dbrow: typeof config.dbrow === 'number' ? config.dbrow : 20,
  };
}

function parseNumericRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number') out[k] = v;
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
    config: parseNumericRecord(rec.config),
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

function parseGenericResults(raw: unknown): GenericResults {
  if (!isRecord(raw)) return {};
  const results: GenericResults = {};
  for (const [indexStr, slots] of Object.entries(raw)) {
    if (!isRecord(slots)) continue;
    const slotMap: Record<
      string,
      { result?: 'success' | 'fail'; amrapReps?: number; rpe?: number }
    > = {};
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!isRecord(slotData)) continue;
      slotMap[slotId] = {
        ...(slotData.result === 'success' || slotData.result === 'fail'
          ? { result: slotData.result }
          : {}),
        ...(typeof slotData.amrapReps === 'number' ? { amrapReps: slotData.amrapReps } : {}),
        ...(typeof slotData.rpe === 'number' ? { rpe: slotData.rpe } : {}),
      };
    }
    results[indexStr] = slotMap;
  }
  return results;
}

function parseGenericUndoHistory(raw: unknown): GenericUndoHistory {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((entry) => ({
    i: typeof entry.i === 'number' ? entry.i : 0,
    slotId: typeof entry.slotId === 'string' ? entry.slotId : '',
    ...(entry.prev === 'success' || entry.prev === 'fail' ? { prev: entry.prev } : {}),
  }));
}

/** Fetch a single program instance with full results and undo history. */
export async function fetchProgram(id: string): Promise<ProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}`);
  if (!isRecord(data)) throw new Error('Invalid program response');

  const genericResults = parseGenericResults(data.results);
  const genericUndo = parseGenericUndoHistory(data.undoHistory);

  return {
    ...parseSummary(data),
    startWeights: parseConfig(data.config),
    results: convertResultsToLegacy(genericResults),
    undoHistory: convertUndoToLegacy(genericUndo),
    resultTimestamps: parseStringRecord(data.resultTimestamps),
  };
}

/** Create a new program instance. */
export async function createProgram(
  programId: string,
  name: string,
  config: Record<string, number>
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
  config: Record<string, number>
): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ config: { ...config } }),
  });
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

/** Record a workout result. Converts tier to slotId at the boundary. */
export async function recordResult(
  instanceId: string,
  workoutIndex: number,
  tier: Tier,
  result: ResultValue,
  amrapReps?: number,
  rpe?: number
): Promise<void> {
  const slotId = tierToSlotId(workoutIndex, tier);
  if (!slotId) {
    throw new Error(`Cannot determine slot for tier ${tier} at workout ${workoutIndex}`);
  }

  await apiFetch(`/programs/${encodeURIComponent(instanceId)}/results`, {
    method: 'POST',
    body: JSON.stringify({
      workoutIndex,
      slotId,
      result,
      ...(amrapReps !== undefined ? { amrapReps } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
    }),
  });
}

/** Delete a specific result. Converts tier to slotId at the boundary. */
export async function deleteResult(
  instanceId: string,
  workoutIndex: number,
  tier: Tier
): Promise<void> {
  const slotId = tierToSlotId(workoutIndex, tier);
  if (!slotId) {
    throw new Error(`Cannot determine slot for tier ${tier} at workout ${workoutIndex}`);
  }

  await apiFetch(
    `/programs/${encodeURIComponent(instanceId)}/results/${workoutIndex}/${encodeURIComponent(slotId)}`,
    { method: 'DELETE' }
  );
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
    config: parseNumericRecord(data.config),
    results: parseGenericResults(data.results),
    undoHistory: parseGenericUndoHistory(data.undoHistory),
    resultTimestamps: parseStringRecord(data.resultTimestamps),
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
  rpe?: number
): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(instanceId)}/results`, {
    method: 'POST',
    body: JSON.stringify({
      workoutIndex,
      slotId,
      result,
      ...(amrapReps !== undefined ? { amrapReps } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
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

function parseCatalogEntry(raw: unknown): CatalogEntry {
  if (!isRecord(raw)) throw new Error('Invalid catalog entry');
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    author: String(raw.author ?? ''),
    category: String(raw.category ?? ''),
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

function parseExerciseEntry(raw: unknown): ExerciseEntry {
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

/** Fetch all exercises visible to the current user (optional auth). */
export async function fetchExercises(): Promise<readonly ExerciseEntry[]> {
  const data = await apiFetch('/exercises');
  if (!Array.isArray(data)) return [];
  return data.map(parseExerciseEntry);
}

/** Fetch all muscle groups (no auth required). */
export async function fetchMuscleGroups(): Promise<readonly MuscleGroupEntry[]> {
  const data = await apiFetch('/muscle-groups');
  if (!Array.isArray(data)) return [];
  return data.map(parseMuscleGroupEntry);
}
