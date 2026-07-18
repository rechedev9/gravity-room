import { describe, expect, it } from 'vitest';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import { buildCycleGroups, groupWorkoutExercises } from './program-preview-showcase';

function createSlot(
  slotId: string,
  exerciseName: string,
  sets: number,
  reps: number,
  isAmrap = false
): GenericSlotRow {
  return {
    slotId,
    exerciseId: exerciseName.toLowerCase(),
    exerciseName,
    tier: 'MAIN',
    weight: 20,
    stage: 0,
    sets,
    reps,
    repsMax: undefined,
    isAmrap,
    stagesCount: 1,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: 'primary',
    notes: undefined,
    prescriptions: undefined,
    isGpp: undefined,
    complexReps: undefined,
    propagatesTo: undefined,
    isTestSlot: undefined,
    isBodyweight: undefined,
    setLogs: undefined,
  };
}

function createWorkout(index: number, dayName: string): GenericWorkoutRow {
  return {
    index,
    dayName,
    slots: [createSlot(`slot-${index}`, 'Sentadilla', 3, 5)],
    isChanged: false,
    completedAt: undefined,
  };
}

describe('buildCycleGroups', () => {
  it('groups only the first cycle into program weeks', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      createWorkout(index, `Sem. ${Math.floor(index / 3) + 1} (5s) — Día ${index + 1}`)
    );

    const groups = buildCycleGroups(rows, 9, 3, (week) => `Semana ${week}`);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.startIndex)).toEqual([0, 3, 6]);
    expect(groups.every((group) => group.workouts.length === 3)).toBe(true);
    expect(groups[0]?.label).toBe('Sem. 1 (5s)');
  });
});

describe('groupWorkoutExercises', () => {
  it('collapses repeated exercise slots into one readable prescription', () => {
    const slots = [
      createSlot('squat-1', 'Sentadilla', 1, 5),
      createSlot('squat-2', 'Sentadilla', 1, 5, true),
      createSlot('bench-1', 'Press Banca', 5, 5),
    ];

    expect(groupWorkoutExercises(slots)).toEqual([
      { exerciseName: 'Sentadilla', schemes: ['1×5', '1×5+'] },
      { exerciseName: 'Press Banca', schemes: ['5×5'] },
    ]);
  });
});
