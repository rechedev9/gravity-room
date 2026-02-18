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
import { GZCLP_DEFINITION } from '@gzclp/shared/programs/gzclp';
import type { StartWeights, Results, UndoHistory, Tier, ResultValue } from '@gzclp/shared/types';
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
}

// ---------------------------------------------------------------------------
// Slot ↔ Tier lookup (reuses GZCLP definition)
// ---------------------------------------------------------------------------

function buildDaySlotMap(): Record<number, Record<string, string>> {
  const map: Record<number, Record<string, string>> = {};
  for (let i = 0; i < GZCLP_DEFINITION.days.length; i++) {
    const day = GZCLP_DEFINITION.days[i];
    map[i] = {};
    for (const slot of day.slots) {
      map[i][slot.tier] = slot.id;
    }
  }
  return map;
}

const DAY_SLOT_MAP = buildDaySlotMap();

/** Convert a tier + workout index to a slot ID. */
export function tierToSlotId(workoutIndex: number, tier: Tier): string | null {
  const dayIndex = workoutIndex % GZCLP_DEFINITION.cycleLength;
  return DAY_SLOT_MAP[dayIndex]?.[tier] ?? null;
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

/** Fetch all program instances for the current user. */
export async function fetchPrograms(): Promise<ProgramSummary[]> {
  const data = await apiFetch('/programs');
  if (!Array.isArray(data)) return [];
  return data.map(parseSummary);
}

/** Fetch a single program instance with full results and undo history. */
export async function fetchProgram(id: string): Promise<ProgramDetail> {
  const data = await apiFetch(`/programs/${encodeURIComponent(id)}`);
  if (!isRecord(data)) throw new Error('Invalid program response');

  // Parse results as GenericResults (Record<string, Record<string, { result?, amrapReps? }>>)
  const rawResults = isRecord(data.results) ? data.results : {};
  const genericResults: GenericResults = {};
  for (const [indexStr, slots] of Object.entries(rawResults)) {
    if (!isRecord(slots)) continue;
    const slotMap: Record<string, { result?: 'success' | 'fail'; amrapReps?: number }> = {};
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!isRecord(slotData)) continue;
      slotMap[slotId] = {
        ...(slotData.result === 'success' || slotData.result === 'fail'
          ? { result: slotData.result }
          : {}),
        ...(typeof slotData.amrapReps === 'number' ? { amrapReps: slotData.amrapReps } : {}),
      };
    }
    genericResults[indexStr] = slotMap;
  }

  // Parse undo history
  const rawUndo = Array.isArray(data.undoHistory) ? data.undoHistory : [];
  const genericUndo: GenericUndoHistory = rawUndo.filter(isRecord).map((entry) => ({
    i: typeof entry.i === 'number' ? entry.i : 0,
    slotId: typeof entry.slotId === 'string' ? entry.slotId : '',
    ...(entry.prev === 'success' || entry.prev === 'fail' ? { prev: entry.prev } : {}),
  }));

  return {
    ...parseSummary(data),
    startWeights: parseConfig(data.config),
    results: convertResultsToLegacy(genericResults),
    undoHistory: convertUndoToLegacy(genericUndo),
  };
}

/** Create a new program instance. */
export async function createProgram(
  programId: string,
  name: string,
  config: StartWeights
): Promise<ProgramSummary> {
  const data = await apiFetch('/programs', {
    method: 'POST',
    body: JSON.stringify({ programId, name, config: { ...config } }),
  });
  return parseSummary(data);
}

/** Update a program instance's config (e.g., start weights). */
export async function updateProgramConfig(id: string, config: StartWeights): Promise<void> {
  await apiFetch(`/programs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ config: { ...config } }),
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
  amrapReps?: number
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
