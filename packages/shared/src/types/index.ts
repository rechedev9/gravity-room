import type { z } from 'zod/v4';
import type {
  StartWeightsSchema,
  ResultsSchema,
  UndoHistorySchema,
  ExportDataSchema,
} from '../schemas/legacy';

export type StartWeights = z.infer<typeof StartWeightsSchema>;
export type Results = z.infer<typeof ResultsSchema>;
export type UndoHistory = z.infer<typeof UndoHistorySchema>;
export type ExportData = z.infer<typeof ExportDataSchema>;
export type ResultValue = 'success' | 'fail';
export type Tier = 't1' | 't2' | 't3';

export interface WorkoutRow {
  index: number;
  dayName: string;
  t1Exercise: string;
  t1Weight: number;
  t1Stage: number;
  t1Sets: number;
  t1Reps: number;
  t2Exercise: string;
  t2Weight: number;
  t2Stage: number;
  t2Sets: number;
  t2Reps: number;
  t3Exercise: string;
  t3Weight: number;
  isChanged: boolean;
  result: {
    t1?: ResultValue;
    t2?: ResultValue;
    t3?: ResultValue;
    t1Reps?: number;
    t3Reps?: number;
    rpe?: number;
    t3Rpe?: number;
  };
}

export interface GenericSlotRow {
  readonly slotId: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly tier: 't1' | 't2' | 't3';
  readonly weight: number;
  readonly stage: number;
  readonly sets: number;
  readonly reps: number;
  readonly isAmrap: boolean;
  readonly result: ResultValue | undefined;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
  readonly isChanged: boolean;
}

export interface GenericWorkoutRow {
  readonly index: number;
  readonly dayName: string;
  readonly slots: readonly GenericSlotRow[];
  readonly isChanged: boolean;
}

export interface ChartDataPoint {
  workout: number;
  weight: number;
  stage: number;
  result: ResultValue | null;
}

export interface ExerciseStats {
  total: number;
  successes: number;
  fails: number;
  rate: number;
  currentWeight: number;
  startWeight: number;
  gained: number;
  currentStage: number;
}
