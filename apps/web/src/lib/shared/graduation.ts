// Pure graduation functions for the MUTENROSHI (Caparazón de Tortuga) program.
// All functions are side-effect-free with explicit return types.

import { roundToNearest } from './generic-engine';

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
 * Compute Epley 1RM estimate: weight * (1 + reps / 30).
 * Returns 0 if weight or reps are 0 or negative.
 */
export function computeEpley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}
