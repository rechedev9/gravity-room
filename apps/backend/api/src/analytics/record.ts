/**
 * Raw workout record shape consumed by every analytics pipeline.
 *
 * Ports the `WorkoutRecord` dataclass from apps/backend/analytics/queries.py.
 * Field names are camelCased to match the TypeScript codebase; the values and
 * their nullability mirror the Python dataclass exactly (rpe / amrapReps /
 * recordedAt may be null, matching `float | None`, `int | None`, `str | None`).
 */
export interface WorkoutRecord {
  readonly userId: string;
  readonly instanceId: string;
  readonly programId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly weight: number;
  /** 'success' | 'fail'. */
  readonly result: string;
  readonly rpe: number | null;
  readonly amrapReps: number | null;
  /** ISO-8601 timestamp string, or null. */
  readonly recordedAt: string | null;
}
