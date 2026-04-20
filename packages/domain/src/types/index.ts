export type ResultValue = 'success' | 'fail';

export interface SetLogEntry {
  readonly reps: number;
  readonly weight?: number | undefined;
  readonly rpe?: number | undefined;
}

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
  readonly prescriptions: readonly ResolvedPrescription[] | undefined;
  readonly isGpp: boolean | undefined;
  readonly complexReps: string | undefined;
  readonly propagatesTo: string | undefined;
  readonly isTestSlot: boolean | undefined;
  readonly isBodyweight: boolean | undefined;
  readonly setLogs: readonly SetLogEntry[] | undefined;
}

export interface GenericWorkoutRow {
  readonly index: number;
  readonly dayName: string;
  readonly slots: readonly GenericSlotRow[];
  readonly isChanged: boolean;
  readonly completedAt: string | undefined;
}

export interface ChartDataPoint {
  readonly workout: number;
  readonly weight: number;
  readonly stage: number;
  readonly result: ResultValue | null;
  readonly date?: string | undefined;
  readonly amrapReps?: number | undefined;
}

export interface RpeDataPoint {
  readonly workout: number;
  readonly rpe: number;
  readonly date?: string | undefined;
}

export interface AmrapDataPoint {
  readonly workout: number;
  readonly reps: number;
  readonly weight: number;
  readonly date?: string | undefined;
}

export interface VolumeDataPoint {
  readonly workout: number;
  readonly volumeKg: number;
  readonly date?: string | undefined;
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
