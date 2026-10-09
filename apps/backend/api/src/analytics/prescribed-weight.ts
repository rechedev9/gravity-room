/**
 * Resolves the weight of a recorded result. Clients only log a weight when the
 * lifter overrides it, so most rows carry none: the prescribed weight is then
 * recovered by replaying the instance through the program engine.
 */
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { isRecord } from '@gzclp/domain/type-guards';
import type { GenericResults, ProgramDefinition } from '@gzclp/domain/types/program';
import type { ResultValue } from '@gzclp/domain/types';

export interface AnalyticsResultRow {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: ResultValue;
  readonly amrapReps: number | null;
  readonly rpe: number | null;
  readonly setLogs: unknown;
  readonly loggedWeight: number | null;
}

export interface InstanceReplaySource {
  readonly definition: ProgramDefinition;
  readonly config: unknown;
}

type SetLogs = NonNullable<GenericResults[string][string]['setLogs']>;

function isSetLogs(value: unknown): value is SetLogs {
  return Array.isArray(value) && value.every((entry) => isRecord(entry));
}

function toEngineConfig(config: unknown): Record<string, number | string> {
  const engineConfig: Record<string, number | string> = {};
  if (!isRecord(config)) return engineConfig;
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'number' || typeof value === 'string') engineConfig[key] = value;
  }
  return engineConfig;
}

function toEngineResults(rows: readonly AnalyticsResultRow[]): GenericResults {
  const results: GenericResults = {};
  for (const row of rows) {
    const workout = (results[String(row.workoutIndex)] ??= {});
    workout[row.slotId] = {
      result: row.result,
      ...(row.amrapReps !== null ? { amrapReps: row.amrapReps } : {}),
      ...(row.rpe !== null ? { rpe: row.rpe } : {}),
      ...(isSetLogs(row.setLogs) ? { setLogs: row.setLogs } : {}),
    };
  }
  return results;
}

export function weightKey(row: Pick<AnalyticsResultRow, 'workoutIndex' | 'slotId'>): string {
  return `${row.workoutIndex}:${row.slotId}`;
}

/** Prescribed weight per recorded slot of one instance, keyed by `weightKey`. */
export function prescribedWeights(
  rows: readonly AnalyticsResultRow[],
  source: InstanceReplaySource
): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  const lastIndex = rows.reduce((max, row) => Math.max(max, row.workoutIndex), -1);
  if (lastIndex < 0) return weights;

  const workouts = computeGenericProgram(
    source.definition,
    toEngineConfig(source.config),
    toEngineResults(rows),
    { maxRows: lastIndex + 1 }
  );
  for (const workout of workouts) {
    for (const slot of workout.slots) {
      // A bodyweight or unloaded slot has no load to analyse.
      if (slot.isBodyweight !== true && slot.weight > 0) {
        weights.set(weightKey({ workoutIndex: workout.index, slotId: slot.slotId }), slot.weight);
      }
    }
  }
  return weights;
}
