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
  readonly weight: number;
  /** 'success' | 'fail'. */
  readonly result: string;
  readonly rpe: number | null;
  readonly amrapReps: number | null;
  /** ISO-8601 timestamp string, or null. */
  readonly recordedAt: string | null;
}
