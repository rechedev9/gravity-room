import { roundToNearest } from './generic-engine';

export interface GraduationTarget {
  readonly exercise: 'squat' | 'bench' | 'deadlift';
  readonly targetWeight: number;
  readonly requiredReps: number;
  readonly description: string;
}

export interface GraduationState {
  readonly squat: boolean;
  readonly bench: boolean;
  readonly deadlift: boolean;
  readonly allPassed: boolean;
}

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

export function computeEpley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}
