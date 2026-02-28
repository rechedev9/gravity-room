// Pure graduation functions for the MUTENROSHI (Fase Zero — Incipit) program.
// All functions are side-effect-free with explicit return types.

/** Graduation target for a single lift */
export interface GraduationTarget {
  readonly exercise: 'squat' | 'bench' | 'deadlift';
  readonly targetWeight: number;
  readonly requiredReps: number;
  readonly description: string;
}

/** Graduation state persisted in program_instances.metadata */
export interface GraduationState {
  readonly squat: boolean;
  readonly bench: boolean;
  readonly deadlift: boolean;
  readonly allPassed: boolean;
}

/** Full graduation status with targets and achievement */
export interface GraduationStatus {
  readonly targets: readonly GraduationTarget[];
  readonly achieved: GraduationState;
  readonly estimatedOneRMs: Readonly<Record<string, number>> | null;
}

/**
 * Round a weight to the nearest multiple of `rounding`.
 * Returns 0 if the result is not finite or negative.
 */
function roundToNearest(value: number, rounding: number): number {
  if (rounding <= 0) return value;
  const rounded = Math.round(value / rounding) * rounding;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return rounded;
}

/**
 * Compute graduation weight targets based on bodyweight and gender.
 * Male: 100% BW, Female: 70% BW, rounded to nearest `rounding`.
 *
 * Returns targets for squat (3 reps), bench (1 rep), deadlift (10 reps).
 */
export function computeGraduationTargets(
  bodyweight: number,
  gender: string,
  rounding: number
): readonly GraduationTarget[] {
  const multiplier = gender === 'female' ? 0.7 : 1.0;
  const targetWeight = roundToNearest(bodyweight * multiplier, rounding);

  return [
    {
      exercise: 'squat',
      targetWeight,
      requiredReps: 3,
      description: `3 reps @ ${targetWeight} kg (tempo 5-3-5)`,
    },
    {
      exercise: 'bench',
      targetWeight,
      requiredReps: 1,
      description: `1 rep @ ${targetWeight} kg (tecnica perfecta)`,
    },
    {
      exercise: 'deadlift',
      targetWeight,
      requiredReps: 10,
      description: `10 reps @ ${targetWeight} kg (controlado)`,
    },
  ] as const;
}

/**
 * Check if a specific graduation criterion is met.
 * - squat: reps >= 3 AND weight >= targetWeight
 * - bench: reps >= 1 AND weight >= targetWeight
 * - deadlift: reps >= 10 AND weight >= targetWeight
 */
export function checkGraduationCriterion(
  exercise: 'squat' | 'bench' | 'deadlift',
  weight: number,
  reps: number,
  targetWeight: number
): boolean {
  if (weight < targetWeight) return false;

  switch (exercise) {
    case 'squat':
      return reps >= 3;
    case 'bench':
      return reps >= 1;
    case 'deadlift':
      return reps >= 10;
  }
}

/**
 * Compute Epley 1RM estimate: weight * (1 + reps / 30).
 * Returns 0 if weight or reps are 0 or negative.
 */
export function computeEpley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

/**
 * Suggest next session weight based on history.
 * - No history (both undefined): return null
 * - Only one session (secondPrevious undefined): previous + rounding
 * - If increased last time (previous > secondPrevious): maintain (consolidate)
 * - If maintained or decreased: increase by rounding
 */
export function suggestNextWeight(
  previousWeight: number | undefined,
  secondPreviousWeight: number | undefined,
  rounding: number
): number | null {
  if (previousWeight === undefined) return null;

  if (secondPreviousWeight === undefined) {
    return roundToNearest(previousWeight + rounding, rounding);
  }

  // If increased last time, consolidate (maintain)
  if (previousWeight > secondPreviousWeight) {
    return previousWeight;
  }

  // If maintained or decreased, suggest increase
  return roundToNearest(previousWeight + rounding, rounding);
}
