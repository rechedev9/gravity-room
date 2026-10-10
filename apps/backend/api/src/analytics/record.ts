import { buildInsightSeriesKey } from '@gzclp/domain/insight-series';

/**
 * Raw workout record shape consumed by every analytics pipeline.
 * `rpe` / `amrapReps` / `recordedAt` may be null.
 */
export interface WorkoutRecord {
  readonly userId: string;
  readonly instanceId: string;
  readonly programId: string;
  readonly workoutIndex: number;
  /** Stable canonical exercise identity captured when the result was written. */
  readonly exerciseId: string;
  /** Definition version that established the slot -> exercise mapping. */
  readonly definitionVersion: number;
  /** Tier of the slot that produced the result; with the exercise it identifies the series. */
  readonly tier: string;
  readonly weight: number;
  /** 'success' | 'fail'. */
  readonly result: string;
  readonly rpe: number | null;
  readonly amrapReps: number | null;
  /** ISO-8601 timestamp string, or null. */
  readonly recordedAt: string | null;
}

/**
 * Maps a record to the key of its series. The key is decided over the user's
 * whole history, so every insight type agrees on it: a lift only ever trained
 * in one tier keeps its bare exercise id.
 */
export function seriesKeyResolver(records: readonly WorkoutRecord[]): (r: WorkoutRecord) => string {
  const tiers = new Map<string, Set<string>>();
  for (const r of records) {
    const seen = tiers.get(r.exerciseId) ?? new Set<string>();
    seen.add(r.tier);
    tiers.set(r.exerciseId, seen);
  }
  return (r) =>
    buildInsightSeriesKey({
      exerciseId: r.exerciseId,
      tier: (tiers.get(r.exerciseId)?.size ?? 0) > 1 ? r.tier : null,
    });
}
