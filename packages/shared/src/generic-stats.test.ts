import { describe, it, expect } from 'bun:test';
import {
  extractGenericChartData,
  calculateStats,
  extractGenericRpeData,
  extractGenericAmrapData,
  extractWeeklyVolumeData,
} from './generic-stats';
import { computeGenericProgram } from './generic-engine';
import { NIVEL7_DEFINITION_FIXTURE as NIVEL7_DEFINITION } from '../test/fixtures';
import type { GenericWorkoutRow, GenericSlotRow } from './types/index';
import type { ProgramDefinition } from './types/program';

const BASE_CONFIG: Record<string, number> = {
  press_mil: 50,
  bench: 70,
  squat: 90,
  deadlift: 110,
};

describe('extractGenericChartData', () => {
  it('should return a key for every exercise in the definition', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    const exerciseIds = Object.keys(NIVEL7_DEFINITION.exercises);
    expect(Object.keys(data).sort()).toEqual(exerciseIds.sort());
  });

  it('should have data points for main lifts across all 48 workouts', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_mil appears once per Monday = 12 times across 48 workouts
    expect(data['press_mil'].length).toBe(12);
    // bench appears once per Thursday = 12 times
    expect(data['bench'].length).toBe(12);
  });

  it('should merge slot variants into a single exercise series', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_mil has 3 phases × 2 cycles = 6 slot IDs, but they're all merged
    // into one series of 12 data points (one per appearance)
    const series = data['press_mil'];
    expect(series[0].weight).toBe(40); // c1b1 week 1
    expect(series[11].weight).toBe(52.5); // c2b2 week 12
  });

  it('should track results when provided', () => {
    const results = {
      '0': { 'press_mil-c1b1': { result: 'success' as const } },
    };
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, results);
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    expect(data['press_mil'][0].result).toBe('success');
    expect(data['press_mil'][1].result).toBeNull();
  });

  it('should produce data compatible with calculateStats', () => {
    const results = {
      '0': { 'press_mil-c1b1': { result: 'success' as const } },
      '4': { 'press_mil-c1b1': { result: 'success' as const } },
      '8': { 'press_mil-c1b1d': { result: 'success' as const } },
    };
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, results);
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);
    const stats = calculateStats(data['press_mil']);

    expect(stats.total).toBe(3);
    expect(stats.successes).toBe(3);
    expect(stats.rate).toBe(100);
    expect(stats.startWeight).toBe(40);
  });

  it('should include accessory exercises', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_franc appears on every Monday = 12 times
    expect(data['press_franc'].length).toBe(12);
    expect(data['press_franc'][0].weight).toBe(0);
    expect(data['press_franc'][0].stage).toBe(1); // stage 0 + 1 = 1
  });
});

// ---------------------------------------------------------------------------
// Minimal fixture factory for Phase 2 tests (tasks 9.1–9.4)
// ---------------------------------------------------------------------------

function makeSlot(
  overrides: Partial<GenericSlotRow> & { slotId: string; exerciseId: string }
): GenericSlotRow {
  return {
    exerciseName: overrides.exerciseName ?? overrides.exerciseId,
    tier: overrides.tier ?? 't1',
    weight: overrides.weight ?? 60,
    stage: overrides.stage ?? 0,
    sets: overrides.sets ?? 5,
    reps: overrides.reps ?? 3,
    repsMax: overrides.repsMax ?? undefined,
    isAmrap: overrides.isAmrap ?? false,
    stagesCount: overrides.stagesCount ?? 1,
    result: overrides.result ?? undefined,
    amrapReps: overrides.amrapReps ?? undefined,
    rpe: overrides.rpe ?? undefined,
    isChanged: overrides.isChanged ?? false,
    isDeload: overrides.isDeload ?? false,
    role: overrides.role ?? 'primary',
    notes: overrides.notes ?? undefined,
    ...overrides,
  };
}

function makeRow(index: number, slots: GenericSlotRow[]): GenericWorkoutRow {
  return {
    index,
    dayName: `Day ${index + 1}`,
    slots,
    isChanged: slots.some((s) => s.isChanged),
  };
}

/** Minimal ProgramDefinition with two exercises for focused unit tests */
const MINIMAL_DEFINITION: ProgramDefinition = {
  id: 'test-minimal',
  name: 'Test Minimal',
  description: 'Minimal fixture for unit tests',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 2,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Sentadilla' },
    bench: { name: 'Press Banca' },
  },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5, group: 'Main' },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5, group: 'Main' },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-s1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'bench-s1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Task 9.1 — extractGenericChartData with timestamps
// ---------------------------------------------------------------------------

describe('extractGenericChartData with timestamps', () => {
  it('populates date field when resultTimestamps provided for matching workout index', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', result: 'success' })]),
    ];
    const timestamps: Record<string, string> = { '0': '2026-01-15T10:00:00Z' };

    const data = extractGenericChartData(MINIMAL_DEFINITION, rows, timestamps);

    expect(data['squat'][0].date).toBeDefined();
    expect(typeof data['squat'][0].date).toBe('string');
    // formatDateLabel produces "15 ene" for Jan 15 of the current year
    expect(data['squat'][0].date).toContain('ene');
  });

  it('date is undefined when resultTimestamps not provided', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', result: 'success' })]),
    ];

    const data = extractGenericChartData(MINIMAL_DEFINITION, rows);

    expect(data['squat'][0].date).toBeUndefined();
  });

  it('invalid date string leaves date undefined without throwing', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', result: 'success' })]),
    ];
    const timestamps: Record<string, string> = { '0': 'not-a-date' };

    expect(() => {
      const data = extractGenericChartData(MINIMAL_DEFINITION, rows, timestamps);
      expect(data['squat'][0].date).toBeUndefined();
    }).not.toThrow();
  });

  it('amrapReps populated from slot amrapReps field', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          result: 'success',
          isAmrap: true,
          amrapReps: 8,
        }),
      ]),
    ];

    const data = extractGenericChartData(MINIMAL_DEFINITION, rows);

    expect(data['squat'][0].amrapReps).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Task 9.2 — extractGenericRpeData
// ---------------------------------------------------------------------------

describe('extractGenericRpeData', () => {
  it('returns RPE points only for slots where rpe is defined', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: 7, result: 'success' }),
      ]),
      makeRow(1, [
        makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', rpe: undefined, result: 'success' }),
      ]),
    ];

    const data = extractGenericRpeData(MINIMAL_DEFINITION, rows);

    expect(data['squat'].length).toBe(1);
    expect(data['squat'][0].rpe).toBe(7);
    expect(data['bench'].length).toBe(0);
  });

  it('groups by exerciseId across multiple rows', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: 6 })]),
      makeRow(1, [makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', rpe: 8 })]),
      makeRow(2, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: 7 })]),
    ];

    const data = extractGenericRpeData(MINIMAL_DEFINITION, rows);

    expect(data['squat'].length).toBe(2);
    expect(data['squat'][0].rpe).toBe(6);
    expect(data['squat'][1].rpe).toBe(7);
    expect(data['bench'].length).toBe(1);
  });

  it('returns empty array for exercises with no RPE recordings', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: undefined })]),
    ];

    const data = extractGenericRpeData(MINIMAL_DEFINITION, rows);

    expect(data['squat']).toEqual([]);
  });

  it('RPE 5 is included (not filtered)', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: 5 })]),
    ];

    const data = extractGenericRpeData(MINIMAL_DEFINITION, rows);

    expect(data['squat'].length).toBe(1);
    expect(data['squat'][0].rpe).toBe(5);
  });

  it('date populated when resultTimestamps provided', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', rpe: 7 })]),
    ];
    const timestamps: Record<string, string> = { '0': '2026-03-10T10:00:00Z' };

    const data = extractGenericRpeData(MINIMAL_DEFINITION, rows, timestamps);

    expect(data['squat'][0].date).toBeDefined();
    expect(typeof data['squat'][0].date).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Task 9.3 — extractGenericAmrapData
// ---------------------------------------------------------------------------

describe('extractGenericAmrapData', () => {
  it('returns AMRAP points only for isAmrap === true and amrapReps > 0 slots', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          isAmrap: true,
          amrapReps: 5,
          result: 'success',
          weight: 80,
        }),
      ]),
    ];

    const data = extractGenericAmrapData(MINIMAL_DEFINITION, rows);

    expect(data['squat'].length).toBe(1);
    expect(data['squat'][0].reps).toBe(5);
    expect(data['squat'][0].weight).toBe(80);
  });

  it('amrapReps === 0 slots excluded', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          isAmrap: true,
          amrapReps: 0,
          result: 'success',
        }),
      ]),
    ];

    const data = extractGenericAmrapData(MINIMAL_DEFINITION, rows);

    expect(data['squat'].length).toBe(0);
  });

  it('non-AMRAP slot excluded', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'bench-s1',
          exerciseId: 'bench',
          isAmrap: false,
          amrapReps: 10,
          result: 'success',
        }),
      ]),
    ];

    const data = extractGenericAmrapData(MINIMAL_DEFINITION, rows);

    expect(data['bench'].length).toBe(0);
  });

  it('weight field on returned point matches slot weight', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          isAmrap: true,
          amrapReps: 7,
          weight: 92.5,
        }),
      ]),
    ];

    const data = extractGenericAmrapData(MINIMAL_DEFINITION, rows);

    expect(data['squat'][0].weight).toBe(92.5);
  });
});

// ---------------------------------------------------------------------------
// Task 9.4 — extractWeeklyVolumeData
// ---------------------------------------------------------------------------

describe('extractWeeklyVolumeData', () => {
  it('volumeKg computed correctly as Math.round(sum of weight * sets * reps for success slots)', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 80,
          sets: 5,
          reps: 3,
          result: 'success',
        }),
        makeSlot({
          slotId: 'bench-s1',
          exerciseId: 'bench',
          weight: 60,
          sets: 3,
          reps: 10,
          result: 'success',
        }),
      ]),
    ];

    const data = extractWeeklyVolumeData(rows);

    // 80*5*3 + 60*3*10 = 1200 + 1800 = 3000
    expect(data.length).toBe(1);
    expect(data[0].volumeKg).toBe(3000);
  });

  it('failed slots excluded from volume', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 80,
          sets: 5,
          reps: 3,
          result: 'success',
        }),
        makeSlot({
          slotId: 'bench-s1',
          exerciseId: 'bench',
          weight: 60,
          sets: 3,
          reps: 10,
          result: 'fail',
        }),
      ]),
    ];

    const data = extractWeeklyVolumeData(rows);

    // Only squat: 80*5*3 = 1200
    expect(data.length).toBe(1);
    expect(data[0].volumeKg).toBe(1200);
  });

  it('workout with no successful slots excluded from output', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 80,
          sets: 5,
          reps: 3,
          result: 'fail',
        }),
      ]),
      makeRow(1, [
        makeSlot({
          slotId: 'bench-s1',
          exerciseId: 'bench',
          weight: 60,
          sets: 3,
          reps: 10,
          result: undefined,
        }),
      ]),
    ];

    const data = extractWeeklyVolumeData(rows);

    expect(data.length).toBe(0);
  });

  it('date populated when resultTimestamps provided', () => {
    const rows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 80,
          sets: 5,
          reps: 3,
          result: 'success',
        }),
      ]),
    ];
    const timestamps: Record<string, string> = { '0': '2026-02-20T10:00:00Z' };

    const data = extractWeeklyVolumeData(rows, timestamps);

    expect(data[0].date).toBeDefined();
    expect(typeof data[0].date).toBe('string');
  });
});
