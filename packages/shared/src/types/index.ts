export type ResultValue = 'success' | 'fail';
export type Tier = string;

/** A resolved prescription with computed weight (output of engine). */
export interface ResolvedPrescription {
  readonly percent: number;
  readonly reps: number;
  readonly sets: number;
  readonly weight: number;
}

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
  readonly isDeload: boolean;
  readonly role: 'primary' | 'secondary' | 'accessory' | undefined;
  readonly notes: string | undefined;
  /** Resolved prescription ladder with computed weights (prescription slots only). */
  readonly prescriptions: readonly ResolvedPrescription[] | undefined;
  /** True for GPP/accessory slots where the athlete picks their own weight. */
  readonly isGpp: boolean | undefined;
  /** Complex rep scheme display string (e.g., '1+3') for compound sets. */
  readonly complexReps: string | undefined;
  /** Config key this slot propagates its test weight to (undefined = no propagation). */
  readonly propagatesTo: string | undefined;
  /** True for test slots (show weight-capture modal regardless of propagation target). */
  readonly isTestSlot: boolean | undefined;
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
