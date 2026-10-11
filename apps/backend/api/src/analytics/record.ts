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
  /** Key of the record's series, decided over the user's whole history. */
  readonly seriesKey: string;
  readonly weight: number;
  /** 'success' | 'fail'. */
  readonly result: string;
  readonly rpe: number | null;
  readonly amrapReps: number | null;
  /** ISO-8601 timestamp string, or null. */
  readonly recordedAt: string | null;
}

/** One identity-bearing result: the lift and the tier it was trained in. */
export interface SeriesPoint {
  readonly exerciseId: string;
  readonly tier: string;
}

/**
 * Maps a result to the key of its series. `history` must be every
 * identity-bearing result of the user, not a window: a lift only ever trained
 * in one tier keeps its bare exercise id, and that must not change over time.
 */
export function seriesKeyResolver(history: readonly SeriesPoint[]): (point: SeriesPoint) => string {
  const tiers = new Map<string, Set<string>>();
  for (const point of history) {
    const seen = tiers.get(point.exerciseId) ?? new Set<string>();
    seen.add(point.tier);
    tiers.set(point.exerciseId, seen);
  }
  return (point) =>
    buildInsightSeriesKey({
      exerciseId: point.exerciseId,
      tier: (tiers.get(point.exerciseId)?.size ?? 0) > 1 ? point.tier : null,
    });
}
