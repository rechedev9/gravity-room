export type ResultValue = 'success' | 'fail';
export type Tier = string;

export interface GenericSlotRow {
  readonly slotId: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly tier: string;
  readonly weight: number;
  readonly stage: number;
  readonly sets: number;
  readonly reps: number;
  readonly repsMax: number | undefined;
  readonly isAmrap: boolean;
  readonly stagesCount: number;
  readonly result: ResultValue | undefined;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
  readonly isChanged: boolean;
  readonly role: 'primary' | 'secondary' | 'accessory' | undefined;
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
