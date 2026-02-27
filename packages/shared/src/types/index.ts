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
  readonly workout: number;
  readonly weight: number;
  readonly stage: number;
  readonly result: ResultValue | null;
  readonly date?: string;
  readonly amrapReps?: number;
}

/** Data point for RPE trend chart (one per workout where RPE was recorded) */
export interface RpeDataPoint {
  readonly workout: number;
  readonly rpe: number;
  readonly date?: string;
}

/** Data point for AMRAP trend chart (one per workout where AMRAP was recorded) */
export interface AmrapDataPoint {
  readonly workout: number;
  readonly reps: number;
  readonly weight: number;
  readonly date?: string;
}

/** Data point for weekly volume bar chart */
export interface VolumeDataPoint {
  readonly workout: number;
  readonly volumeKg: number;
  readonly date?: string;
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
