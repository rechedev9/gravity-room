import { describe, expect, it } from 'vitest';

import { calculateStats, extractAllGenericStats } from './generic-stats';
import type { GenericWorkoutRow } from './types';
import type { ProgramDefinition } from './schemas/program-definition';

const DEFINITION: ProgramDefinition = {
  id: 'stats-prog',
  name: 'Stats Program',
  description: 'Fixture for stats extraction.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 1,
  totalWorkouts: 3,
  workoutsPerWeek: 1,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 3, reps: 5, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
        {
          id: 'bench-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [{ sets: 3, reps: 8 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

function makeSlot(
  overrides: Partial<GenericWorkoutRow['slots'][number]> &
    Pick<GenericWorkoutRow['slots'][number], 'slotId' | 'exerciseId' | 'exerciseName'>
): GenericWorkoutRow['slots'][number] {
  return {
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 3,
    reps: 5,
    repsMax: undefined,
    isAmrap: false,
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
    ...overrides,
  };
}

describe('extractAllGenericStats', () => {
  it('computes volume from weight × sets × reps when setLogs are absent', () => {
    const rows: GenericWorkoutRow[] = [
      {
        index: 0,
        dayName: 'Day A',
        isChanged: false,
        completedAt: undefined,
        slots: [
          makeSlot({
            slotId: 'squat-t1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            weight: 100,
            sets: 3,
            reps: 5,
            result: 'success',
          }),
          makeSlot({
            slotId: 'bench-t2',
            exerciseId: 'bench',
            exerciseName: 'Bench',
            weight: 60,
            sets: 3,
            reps: 8,
            result: 'fail',
          }),
        ],
      },
    ];

    const stats = extractAllGenericStats(DEFINITION, rows);
    // Only success contributes: 100 * 3 * 5 = 1500
    expect(stats.volumeData).toEqual([{ workout: 1, volumeKg: 1500, date: undefined }]);
  });

  it('prefers setLogs for volume when present (per-set weight × reps)', () => {
    const rows: GenericWorkoutRow[] = [
      {
        index: 0,
        dayName: 'Day A',
        isChanged: false,
        completedAt: undefined,
        slots: [
          makeSlot({
            slotId: 'squat-t1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            weight: 100,
            sets: 3,
            reps: 5,
            result: 'success',
            setLogs: [
              { reps: 5, weight: 100 },
              { reps: 5, weight: 100 },
              { reps: 8, weight: 100 },
            ],
          }),
          makeSlot({
            slotId: 'bench-t2',
            exerciseId: 'bench',
            exerciseName: 'Bench',
            weight: 60,
            result: 'success',
            setLogs: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
          }),
        ],
      },
    ];

    const stats = extractAllGenericStats(DEFINITION, rows);
    // squat: (100*5)+(100*5)+(100*8) = 1800; bench: 60*8*3 = 1440; total 3240
    expect(stats.volumeData[0]?.volumeKg).toBe(3240);
  });

  it('collects chart, rpe, and amrap series per exercise', () => {
    const rows: GenericWorkoutRow[] = [
      {
        index: 0,
        dayName: 'Day A',
        isChanged: false,
        completedAt: undefined,
        slots: [
          makeSlot({
            slotId: 'squat-t1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            weight: 100,
            stage: 0,
            result: 'success',
            isAmrap: true,
            amrapReps: 12,
            rpe: 8,
          }),
          makeSlot({
            slotId: 'bench-t2',
            exerciseId: 'bench',
            exerciseName: 'Bench',
            weight: 60,
            result: 'fail',
            rpe: 9,
          }),
        ],
      },
      {
        index: 1,
        dayName: 'Day A',
        isChanged: true,
        completedAt: undefined,
        slots: [
          makeSlot({
            slotId: 'squat-t1',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            weight: 105,
            stage: 0,
            result: 'success',
            isAmrap: true,
            amrapReps: 10,
          }),
          makeSlot({
            slotId: 'bench-t2',
            exerciseId: 'bench',
            exerciseName: 'Bench',
            weight: 62.5,
            result: 'success',
          }),
        ],
      },
    ];

    const timestamps = {
      '0': '2026-01-15T10:00:00.000Z',
      '1': '2026-01-17T10:00:00.000Z',
    };
    const stats = extractAllGenericStats(DEFINITION, rows, timestamps);

    expect(stats.chartData.squat).toHaveLength(2);
    expect(stats.chartData.squat?.[0]).toMatchObject({
      workout: 1,
      weight: 100,
      stage: 1,
      result: 'success',
      amrapReps: 12,
    });
    expect(stats.chartData.squat?.[0]?.date).toBeDefined();

    expect(stats.rpeData.squat).toEqual([expect.objectContaining({ workout: 1, rpe: 8 })]);
    expect(stats.rpeData.bench).toEqual([expect.objectContaining({ workout: 1, rpe: 9 })]);

    expect(stats.amrapData.squat).toEqual([
      expect.objectContaining({ workout: 1, reps: 12, weight: 100 }),
      expect.objectContaining({ workout: 2, reps: 10, weight: 105 }),
    ]);
    expect(stats.amrapData.bench).toEqual([]);
  });
});

describe('calculateStats', () => {
  it('computes success rate, weight gain, and current stage', () => {
    const stats = calculateStats([
      { workout: 1, weight: 60, stage: 1, result: 'success', date: undefined },
      { workout: 2, weight: 65, stage: 1, result: 'fail', date: undefined },
      { workout: 3, weight: 65, stage: 2, result: 'success', date: undefined },
      { workout: 4, weight: 70, stage: 2, result: null, date: undefined },
    ]);

    expect(stats.total).toBe(3);
    expect(stats.successes).toBe(2);
    expect(stats.fails).toBe(1);
    expect(stats.rate).toBe(67);
    expect(stats.startWeight).toBe(60);
    expect(stats.currentWeight).toBe(65);
    expect(stats.gained).toBe(5);
    expect(stats.currentStage).toBe(2);
  });

  it('returns zeros for empty data', () => {
    expect(calculateStats([])).toEqual({
      total: 0,
      successes: 0,
      fails: 0,
      rate: 0,
      currentWeight: 0,
      startWeight: 0,
      gained: 0,
      currentStage: 1,
    });
  });
});
