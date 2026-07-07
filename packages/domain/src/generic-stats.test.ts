import { describe, expect, it } from 'vitest';

import { calculateStats, extractAllGenericStats } from './generic-stats';
import type { ProgramDefinition } from './schemas/program-definition';
import type { ChartDataPoint, GenericSlotRow, GenericWorkoutRow } from './types';

const DEFINITION: ProgramDefinition = {
  id: 'stats-prog',
  name: 'Stats Program',
  description: 'Minimal fixture for generic stats tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 1,
  totalWorkouts: 10,
  workoutsPerWeek: 1,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench Press' },
  },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 3, reps: 5 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
};

function makeSlotRow(overrides: Partial<GenericSlotRow>): GenericSlotRow {
  return {
    slotId: 'squat-t1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
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

function makeRow(index: number, slots: readonly GenericSlotRow[]): GenericWorkoutRow {
  return {
    index,
    dayName: 'Day A',
    slots,
    isChanged: false,
    completedAt: undefined,
  };
}

describe('extractAllGenericStats', () => {
  it('computes volume from set logs, falling back to the slot weight per set', () => {
    // Arrange: one set logged at an explicit 110 kg, one inheriting slot.weight (100 kg).
    const rows = [
      makeRow(0, [
        makeSlotRow({
          result: 'success',
          weight: 100,
          setLogs: [{ reps: 5, weight: 110 }, { reps: 3 }],
        }),
      ]),
    ];

    // Act
    const { volumeData } = extractAllGenericStats(DEFINITION, rows);

    // Assert: 5*110 + 3*100 = 850
    expect(volumeData).toEqual([{ workout: 1, volumeKg: 850, date: undefined }]);
  });

  it('computes volume as weight * sets * reps when there are no set logs', () => {
    const rows = [makeRow(0, [makeSlotRow({ result: 'success', weight: 100, sets: 3, reps: 5 })])];

    const { volumeData } = extractAllGenericStats(DEFINITION, rows);

    expect(volumeData[0]?.volumeKg).toBe(1500);
  });

  it('falls back to the flat formula when setLogs is an empty array', () => {
    const rows = [
      makeRow(0, [makeSlotRow({ result: 'success', weight: 60, sets: 2, reps: 10, setLogs: [] })]),
    ];

    const { volumeData } = extractAllGenericStats(DEFINITION, rows);

    expect(volumeData[0]?.volumeKg).toBe(1200);
  });

  it('accumulates volume only for slots marked success', () => {
    const rows = [
      makeRow(0, [
        makeSlotRow({ result: 'fail', weight: 100 }),
        makeSlotRow({ slotId: 'bench-t2', exerciseId: 'bench', result: undefined, weight: 60 }),
      ]),
      makeRow(1, [makeSlotRow({ result: 'success', weight: 100, sets: 3, reps: 5 })]),
    ];

    const { volumeData } = extractAllGenericStats(DEFINITION, rows);

    // Workout 1 (all fail/unmarked) produces no volume point at all.
    expect(volumeData).toEqual([{ workout: 2, volumeKg: 1500, date: undefined }]);
  });

  it('rounds the accumulated volume to whole kilograms', () => {
    const rows = [
      makeRow(0, [makeSlotRow({ result: 'success', weight: 2.6, sets: 1, reps: 3, setLogs: [] })]),
    ];

    const { volumeData } = extractAllGenericStats(DEFINITION, rows);

    // 2.6 * 3 = 7.8 -> rounds to 8
    expect(volumeData[0]?.volumeKg).toBe(8);
  });

  it('records AMRAP points only when the slot is AMRAP and reps are positive', () => {
    const rows = [
      makeRow(0, [makeSlotRow({ isAmrap: true, amrapReps: 8, weight: 100 })]),
      makeRow(1, [makeSlotRow({ isAmrap: true, amrapReps: 0 })]),
      makeRow(2, [makeSlotRow({ isAmrap: true, amrapReps: undefined })]),
      makeRow(3, [makeSlotRow({ isAmrap: false, amrapReps: 12 })]),
    ];

    const { amrapData } = extractAllGenericStats(DEFINITION, rows);

    expect(amrapData['squat']).toEqual([{ workout: 1, reps: 8, weight: 100, date: undefined }]);
  });

  it('records RPE points only for slots that logged an RPE', () => {
    const rows = [
      makeRow(0, [makeSlotRow({ rpe: 9 })]),
      makeRow(1, [makeSlotRow({ rpe: undefined })]),
    ];

    const { rpeData } = extractAllGenericStats(DEFINITION, rows);

    expect(rpeData['squat']).toEqual([{ workout: 1, rpe: 9, date: undefined }]);
    expect(rpeData['bench']).toEqual([]);
  });

  it('buckets chart points per exercise and normalizes stage/result', () => {
    const rows = [
      makeRow(0, [
        makeSlotRow({ exerciseId: 'squat', weight: 100, stage: 0, result: 'success' }),
        makeSlotRow({
          slotId: 'bench-t2',
          exerciseId: 'bench',
          weight: 60,
          stage: 2,
          result: undefined,
          amrapReps: 7,
        }),
      ]),
    ];

    const { chartData } = extractAllGenericStats(DEFINITION, rows);

    expect(chartData['squat']).toEqual([
      {
        workout: 1,
        weight: 100,
        stage: 1,
        result: 'success',
        date: undefined,
        amrapReps: undefined,
      },
    ]);
    // stage is 1-based in chart points; an unmarked result becomes null.
    expect(chartData['bench']).toEqual([
      { workout: 1, weight: 60, stage: 3, result: null, date: undefined, amrapReps: 7 },
    ]);
  });

  it('ignores slots whose exercise is not in the definition everywhere, volume included', () => {
    const rows = [makeRow(0, [makeSlotRow({ exerciseId: 'unknown-exercise', result: 'success' })])];

    const stats = extractAllGenericStats(DEFINITION, rows);

    expect(stats.chartData['unknown-exercise']).toBeUndefined();
    // Orphaned slots must not leak into the aggregate volume either: no chart
    // could ever display the lifts being counted.
    expect(stats.volumeData).toEqual([]);
  });

  it('initializes an empty bucket for every exercise in the definition', () => {
    const stats = extractAllGenericStats(DEFINITION, []);

    expect(Object.keys(stats.chartData).sort()).toEqual(['bench', 'squat']);
    expect(stats.chartData['squat']).toEqual([]);
    expect(stats.rpeData['bench']).toEqual([]);
    expect(stats.amrapData['squat']).toEqual([]);
    expect(stats.volumeData).toEqual([]);
  });

  describe('date labels from result timestamps', () => {
    // Build dates relative to the current year so the tests never rot at a
    // year boundary: the formatter appends a 2-digit year only for dates in
    // a year strictly before the current one.
    const currentYear = new Date().getFullYear();
    const priorYear = currentYear - 1;
    const priorYearSuffix = String(priorYear % 100).padStart(2, '0');

    it('labels current-year dates without a year and prior-year dates with a 2-digit year', () => {
      const rows = [makeRow(0, [makeSlotRow({})]), makeRow(1, [makeSlotRow({})])];
      const timestamps = {
        '0': `${currentYear}-03-15T12:00:00.000Z`,
        '1': `${priorYear}-03-15T12:00:00.000Z`,
      };

      const { chartData } = extractAllGenericStats(DEFINITION, rows, timestamps);

      const currentLabel = chartData['squat']?.[0]?.date;
      const priorLabel = chartData['squat']?.[1]?.date;
      expect(currentLabel).toBeDefined();
      expect(currentLabel).not.toContain(priorYearSuffix);
      expect(priorLabel).toBeDefined();
      expect(priorLabel).toContain(priorYearSuffix);
    });

    it('formats labels with the provided locale (es-ES remains the default)', () => {
      const rows = [makeRow(0, [makeSlotRow({})])];
      // January: a month whose short name differs across es/en locale data.
      const timestamps = { '0': `${currentYear}-01-15T12:00:00.000Z` };

      const defaultLabel = extractAllGenericStats(DEFINITION, rows, timestamps).chartData[
        'squat'
      ]?.[0]?.date;
      const englishLabel = extractAllGenericStats(DEFINITION, rows, timestamps, 'en-US').chartData[
        'squat'
      ]?.[0]?.date;

      expect(defaultLabel).toBeDefined();
      expect(englishLabel).toBeDefined();
      expect(englishLabel).not.toBe(defaultLabel);
      expect(englishLabel).toContain('Jan');
    });

    it('leaves the date undefined for missing or unparseable timestamps', () => {
      const rows = [makeRow(0, [makeSlotRow({})]), makeRow(1, [makeSlotRow({})])];
      const timestamps = { '1': 'not-a-date' };

      const { chartData } = extractAllGenericStats(DEFINITION, rows, timestamps);

      expect(chartData['squat']?.[0]?.date).toBeUndefined();
      expect(chartData['squat']?.[1]?.date).toBeUndefined();
    });
  });
});

describe('calculateStats', () => {
  function point(overrides: Partial<ChartDataPoint>): ChartDataPoint {
    return { workout: 1, weight: 100, stage: 1, result: null, ...overrides };
  }

  it('returns zeroed stats (stage 1) for empty data', () => {
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

  it('counts only marked workouts and rounds the success rate to a whole percent', () => {
    const data = [
      point({ workout: 1, result: 'success' }),
      point({ workout: 2, result: 'success' }),
      point({ workout: 3, result: 'fail' }),
      point({ workout: 4, result: null }),
    ];

    const stats = calculateStats(data);

    expect(stats.total).toBe(3);
    expect(stats.successes).toBe(2);
    expect(stats.fails).toBe(1);
    expect(stats.rate).toBe(67); // 2/3 rounded
  });

  it('derives gained and currentWeight from the last marked point, not trailing unmarked ones', () => {
    const data = [
      point({ workout: 1, weight: 100, result: 'success' }),
      point({ workout: 2, weight: 107.5, stage: 2, result: 'fail' }),
      point({ workout: 3, weight: 200, stage: 3, result: null }),
    ];

    const stats = calculateStats(data);

    expect(stats.startWeight).toBe(100);
    expect(stats.currentWeight).toBe(107.5);
    expect(stats.gained).toBe(7.5);
    expect(stats.currentStage).toBe(2);
  });

  it('falls back to the first weight and default stage when nothing is marked yet', () => {
    const data = [point({ workout: 1, weight: 80, stage: 2, result: null })];

    const stats = calculateStats(data);

    expect(stats.currentWeight).toBe(80);
    expect(stats.startWeight).toBe(80);
    expect(stats.gained).toBe(0);
    expect(stats.rate).toBe(0);
    expect(stats.currentStage).toBe(1);
  });

  it('reports a negative gain after a deload', () => {
    const data = [
      point({ workout: 1, weight: 100, result: 'fail' }),
      point({ workout: 2, weight: 85, result: 'success' }),
    ];

    expect(calculateStats(data).gained).toBe(-15);
  });
});
