import {
  ExerciseEntrySchema,
  MuscleGroupEntrySchema,
  PaginatedExercisesResponseSchema,
  type ExerciseEntry,
  type MuscleGroupEntry,
} from '@gzclp/domain';
import { fetchWithAccessToken } from '../auth/session';

export const EXERCISE_PAGE_SIZE = 30;
const MAX_SEARCH_LENGTH = 100;

export interface ExerciseFilters {
  readonly search: string;
  readonly muscleGroupId: string | null;
}

export interface ExercisePage {
  readonly items: readonly ExerciseEntry[];
  readonly total: number;
  readonly offset: number;
  /** Rows the server returned, including any dropped as unreadable. */
  readonly received: number;
}

/** `network` covers offline, timeouts and a missing session; the others reached the server. */
export type ExerciseFailure = 'network' | 'server' | 'invalid';

export class ExerciseRequestError extends Error {
  constructor(readonly failure: ExerciseFailure) {
    super(`Exercise request failed: ${failure}`);
    this.name = 'ExerciseRequestError';
  }
}

export function buildExercisesPath(input: {
  readonly filters: ExerciseFilters;
  readonly offset: number;
  readonly limit: number;
}): string {
  const params = [`limit=${input.limit}`, `offset=${input.offset}`];
  const search = input.filters.search.trim().slice(0, MAX_SEARCH_LENGTH);
  if (search.length > 0) params.push(`q=${encodeURIComponent(search)}`);
  if (input.filters.muscleGroupId) {
    params.push(`muscleGroupId=${encodeURIComponent(input.filters.muscleGroupId)}`);
  }
  return `/exercises?${params.join('&')}`;
}

async function readJson(path: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    ({ response } = await fetchWithAccessToken(path, { signal }));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ExerciseRequestError('network');
  }
  if (!response.ok) throw new ExerciseRequestError('server');
  try {
    return await response.json();
  } catch {
    throw new ExerciseRequestError('invalid');
  }
}

export async function fetchExercisePage(input: {
  readonly filters: ExerciseFilters;
  readonly offset: number;
  readonly signal: AbortSignal;
}): Promise<ExercisePage> {
  const path = buildExercisesPath({
    filters: input.filters,
    offset: input.offset,
    limit: EXERCISE_PAGE_SIZE,
  });
  const parsed = PaginatedExercisesResponseSchema.safeParse(await readJson(path, input.signal));
  if (!parsed.success) throw new ExerciseRequestError('invalid');
  const items = parsed.data.data
    .map((row) => ExerciseEntrySchema.parse(row))
    .filter((entry) => entry.id !== '' && entry.name !== '');
  return {
    items,
    total: parsed.data.total,
    offset: parsed.data.offset,
    received: parsed.data.data.length,
  };
}

export async function fetchMuscleGroups(signal: AbortSignal): Promise<readonly MuscleGroupEntry[]> {
  const payload = await readJson('/muscle-groups', signal);
  if (!Array.isArray(payload)) throw new ExerciseRequestError('invalid');
  return payload.map((row) => MuscleGroupEntrySchema.parse(row)).filter((group) => group.id !== '');
}
