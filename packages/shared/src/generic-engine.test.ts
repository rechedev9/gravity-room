import { describe, it, expect } from 'bun:test';
import { computeGenericProgram, roundToNearestHalf as round } from './generic-engine';
import { GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS } from '../test/fixtures';
import type { ProgramDefinition, GenericResults } from './types/program';
import {
  ProgressionRuleSchema,
  ExerciseSlotSchema,
  StageDefinitionSchema,
  ConfigFieldSchema,
  ProgramDefinitionSchema,
} from './schemas/program-definition';
import { MUTENROSHI_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/mutenroshi';
import { GZCLP_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/gzclp';
import { PPL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/ppl531';
import { STRONGLIFTS_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/stronglifts';
import { GSLP_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/greyskull';
import { BBB_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/bbb';
import { FSL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/fsl531';
import { PHUL_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/phul';
import { NIVEL7_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/nivel7';
import { BRUNETTI365_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/brunetti-365';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type SlotOverrides = {
  stages?: Array<{ sets: number; reps: number; amrap?: boolean; repsMax?: number }>;
  onSuccess?: ProgramDefinition['days'][number]['slots'][number]['onSuccess'];
  onFinalStageSuccess?: ProgramDefinition['days'][number]['slots'][number]['onSuccess'];
  onUndefined?: ProgramDefinition['days'][number]['slots'][number]['onUndefined'];
  onMidStageFail?: ProgramDefinition['days'][number]['slots'][number]['onMidStageFail'];
  onFinalStageFail?: ProgramDefinition['days'][number]['slots'][number]['onFinalStageFail'];
  weightIncrement?: number;
  totalWorkouts?: number;
  trainingMaxKey?: string;
  tmPercent?: number;
  role?: 'primary' | 'secondary' | 'accessory';
  tier?: string;
  /** Additional slots to add alongside the default slot. */
  extraSlots?: Array<{
    id: string;
    exerciseId: string;
    tier: string;
    stages: Array<{ sets: number; reps: number; amrap?: boolean; repsMax?: number }>;
    onSuccess: ProgramDefinition['days'][number]['slots'][number]['onSuccess'];
    onMidStageFail: ProgramDefinition['days'][number]['slots'][number]['onMidStageFail'];
    onFinalStageFail: ProgramDefinition['days'][number]['slots'][number]['onFinalStageFail'];
    startWeightKey: string;
    trainingMaxKey?: string;
    tmPercent?: number;
    role?: 'primary' | 'secondary' | 'accessory';
    onUndefined?: ProgramDefinition['days'][number]['slots'][number]['onUndefined'];
  }>;
  /** Extra exercises to register (e.g. { ex2: { name: 'Exercise 2' } }) */
  extraExercises?: Record<string, { name: string }>;
  /** Extra weight increments (e.g. { ex2: 2.5 }) */
  extraIncrements?: Record<string, number>;
  /** Extra config fields */
  extraConfigFields?: Array<{
    key: string;
    label: string;
    type: 'weight';
    min: number;
    step: number;
  }>;
};

/** Minimal single-exercise program for testing individual rules in isolation. */
function makeDefinition(overrides: SlotOverrides): ProgramDefinition {
  const primarySlot: ProgramDefinition['days'][number]['slots'][number] = {
    id: 'slot1',
    exerciseId: 'ex',
    tier: overrides.tier ?? 't1',
    stages: overrides.stages ?? [
      { sets: 5, reps: 3 },
      { sets: 6, reps: 2 },
      { sets: 10, reps: 1 },
    ],
    onSuccess: overrides.onSuccess ?? { type: 'add_weight' },
    onFinalStageSuccess: overrides.onFinalStageSuccess,
    onUndefined: overrides.onUndefined,
    onMidStageFail: overrides.onMidStageFail ?? { type: 'advance_stage' },
    onFinalStageFail: overrides.onFinalStageFail ?? {
      type: 'deload_percent',
      percent: 10,
    },
    startWeightKey: overrides.trainingMaxKey ?? 'ex',
    trainingMaxKey: overrides.trainingMaxKey,
    tmPercent: overrides.tmPercent,
    role: overrides.role,
  };

  const slots: ProgramDefinition['days'][number]['slots'] = [
    primarySlot,
    ...(overrides.extraSlots ?? []),
  ];

  return {
    id: 'test',
    name: 'Test',
    description: '',
    author: 'test',
    version: 1,
    category: 'test',
    source: 'preset',
    cycleLength: 1,
    totalWorkouts: overrides.totalWorkouts ?? 10,
    workoutsPerWeek: 3,
    exercises: { ex: { name: 'Exercise' }, ...overrides.extraExercises },
    configFields: [
      {
        key: overrides.trainingMaxKey ?? 'ex',
        label: 'Exercise',
        type: 'weight' as const,
        min: 0,
        step: 2.5,
      },
      ...(overrides.extraConfigFields ?? []),
    ],
    weightIncrements: { ex: overrides.weightIncrement ?? 5, ...overrides.extraIncrements },
    days: [
      {
        name: 'Day 1',
        slots,
      },
    ],
  };
}

/** GZCLP day slot map used for converting legacy results in parity tests. */
const GZCLP_DAY_SLOT_MAP = GZCLP_DEFINITION_FIXTURE.days.map((day) => ({
  t1: day.slots.find((s) => s.tier === 't1')?.id ?? '',
  t2: day.slots.find((s) => s.tier === 't2')?.id ?? '',
  t3: day.slots.find((s) => s.tier === 't3')?.id ?? '',
}));

/** Legacy result entry for GZCLP parity tests. */
type LegacyResultEntry = [
  number,
  {
    t1?: 'success' | 'fail';
    t2?: 'success' | 'fail';
    t3?: 'success' | 'fail';
    t1Reps?: number;
    t3Reps?: number;
  },
];

/** Convert GZCLP legacy results to generic format for parity tests. */
function toGenericResults(entries: LegacyResultEntry[]): GenericResults {
  const generic: GenericResults = {};
  for (const [i, res] of entries) {
    const dayMap = GZCLP_DAY_SLOT_MAP[i % 4];
    const workout: Record<string, { result?: 'success' | 'fail'; amrapReps?: number }> = {};
    if (res.t1 !== undefined || res.t1Reps !== undefined) {
      workout[dayMap.t1] = { result: res.t1, amrapReps: res.t1Reps };
    }
    if (res.t2 !== undefined) {
      workout[dayMap.t2] = { result: res.t2 };
    }
    if (res.t3 !== undefined || res.t3Reps !== undefined) {
      workout[dayMap.t3] = { result: res.t3, amrapReps: res.t3Reps };
    }
    if (Object.keys(workout).length > 0) {
      generic[String(i)] = workout;
    }
  }
  return generic;
}

/** Convert all-success legacy results to generic format. */
function toGenericSuccessResults(n: number): GenericResults {
  return toGenericResults(
    Array.from({ length: n }, (_, i) => [
      i,
      { t1: 'success' as const, t2: 'success' as const, t3: 'success' as const },
    ])
  );
}

// ---------------------------------------------------------------------------
// roundToNearestHalf
// ---------------------------------------------------------------------------
describe('roundToNearestHalf', () => {
  it('rounds 0.7 to 0.5', () => {
    expect(round(0.7)).toBe(0.5);
  });

  it('rounds 0.8 to 1.0', () => {
    expect(round(0.8)).toBe(1.0);
  });

  it('returns 0 for negative values', () => {
    expect(round(-5)).toBe(0);
  });

  it('returns the value unchanged when already a half', () => {
    expect(round(16.5)).toBe(16.5);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------
describe('computeGenericProgram: structural invariants', () => {
  it('produces exactly totalWorkouts rows', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    expect(rows).toHaveLength(GZCLP_DEFINITION_FIXTURE.totalWorkouts);
  });

  it('cycles days by cycleLength', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].dayName).toBe(GZCLP_DEFINITION_FIXTURE.days[i % 4].name);
    }
  });

  it('never produces negative weights', () => {
    const allFail: GenericResults = {};
    for (let i = 0; i < 90; i++) {
      allFail[String(i)] = {
        [GZCLP_DAY_SLOT_MAP[i % 4].t1]: { result: 'fail' },
        [GZCLP_DAY_SLOT_MAP[i % 4].t2]: { result: 'fail' },
        [GZCLP_DAY_SLOT_MAP[i % 4].t3]: { result: 'fail' },
      };
    }
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, allFail);
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps stage within [0, stages.length - 1] under all failures', () => {
    const allFail: GenericResults = {};
    for (let i = 0; i < 90; i++) {
      allFail[String(i)] = {
        [GZCLP_DAY_SLOT_MAP[i % 4].t1]: { result: 'fail' },
      };
    }
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, allFail);
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.stage).toBeGreaterThanOrEqual(0);
        const maxStage =
          GZCLP_DEFINITION_FIXTURE.days.flatMap((d) => d.slots).find((s) => s.id === slot.slotId)
            ?.stages.length ?? 1;
        expect(slot.stage).toBeLessThan(maxStage);
      }
    }
  });

  it('handles empty results (all implicit pass)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    expect(rows).toHaveLength(90);
  });
});

// ---------------------------------------------------------------------------
// GZCLP parity — generic engine must match legacy computeProgram outputs
// ---------------------------------------------------------------------------
describe('computeGenericProgram: GZCLP parity', () => {
  it('matches T1 start weights from DEFAULT_WEIGHTS', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    // Day 1 t1 = squat
    expect(rows[0].slots.find((s) => s.tier === 't1')?.weight).toBe(DEFAULT_WEIGHTS.squat);
    // Day 2 t1 = ohp
    expect(rows[1].slots.find((s) => s.tier === 't1')?.weight).toBe(DEFAULT_WEIGHTS.ohp);
    // Day 3 t1 = bench
    expect(rows[2].slots.find((s) => s.tier === 't1')?.weight).toBe(DEFAULT_WEIGHTS.bench);
    // Day 4 t1 = deadlift
    expect(rows[3].slots.find((s) => s.tier === 't1')?.weight).toBe(DEFAULT_WEIGHTS.deadlift);
  });

  it('matches T2 start weights as 65% rounded to nearest 0.5', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    // Day 1 t2 = bench: 40 * 0.65 = 26
    expect(rows[0].slots.find((s) => s.tier === 't2')?.weight).toBe(
      round(DEFAULT_WEIGHTS.bench * 0.65)
    );
    // Day 2 t2 = deadlift: 80 * 0.65 = 52
    expect(rows[1].slots.find((s) => s.tier === 't2')?.weight).toBe(
      round(DEFAULT_WEIGHTS.deadlift * 0.65)
    );
    // Day 4 t2 = ohp: 25 * 0.65 = 16.25 → 16.5
    expect(rows[3].slots.find((s) => s.tier === 't2')?.weight).toBe(
      round(DEFAULT_WEIGHTS.ohp * 0.65)
    );
  });

  it('does NOT increase T3 weight with empty results (matches legacy implicit-pass behavior)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    // latpulldown T3 at Day 1 (i=0,4,8,...) and Day 3 (i=2,6,10,...)
    const t3Rows = rows.filter(
      (r) => r.slots.find((s) => s.tier === 't3')?.exerciseId === 'latpulldown'
    );
    const t3Weights = t3Rows.map((r) => r.slots.find((s) => s.tier === 't3')?.weight);
    // All should be the same starting weight since no explicit success
    for (const w of t3Weights) {
      expect(w).toBe(DEFAULT_WEIGHTS.latpulldown);
    }
  });

  it('increases T3 on explicit success only', () => {
    const results = toGenericResults([
      [0, { t3: 'success' }],
      [2, { t3: 'fail' }],
      [4, { t3: 'success' }],
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    // latpulldown at 0, 2, 4, 6
    expect(rows[0].slots.find((s) => s.tier === 't3')?.weight).toBe(30);
    expect(rows[2].slots.find((s) => s.tier === 't3')?.weight).toBe(32.5); // after success at 0
    expect(rows[4].slots.find((s) => s.tier === 't3')?.weight).toBe(32.5); // no change on fail at 2
    expect(rows[6].slots.find((s) => s.tier === 't3')?.weight).toBe(35); // after success at 4
  });

  it('T1 increases weight on each implicit pass (empty results)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    // squat T1 at indexes 0, 4, 8, 12, ...
    const squatT1 = rows.filter(
      (r) => r.slots.find((s) => s.tier === 't1')?.exerciseId === 'squat'
    );
    expect(squatT1[0].slots.find((s) => s.tier === 't1')?.weight).toBe(60);
    expect(squatT1[1].slots.find((s) => s.tier === 't1')?.weight).toBe(65);
    expect(squatT1[2].slots.find((s) => s.tier === 't1')?.weight).toBe(70);
  });

  it('T1 advances through stages on failure then deloads', () => {
    const results = toGenericResults([
      [0, { t1: 'fail' }], // stage 0 → stage 1
      [4, { t1: 'fail' }], // stage 1 → stage 2
      [8, { t1: 'fail' }], // stage 2 → deload, reset stage 0
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    const t1 = (i: number) => rows[i].slots.find((s) => s.tier === 't1');

    expect(t1(4)?.stage).toBe(1);
    expect(t1(4)?.weight).toBe(60);
    expect(t1(4)?.sets).toBe(6);
    expect(t1(4)?.reps).toBe(2);

    expect(t1(8)?.stage).toBe(2);
    expect(t1(8)?.weight).toBe(60);
    expect(t1(8)?.sets).toBe(10);
    expect(t1(8)?.reps).toBe(1);

    expect(t1(12)?.stage).toBe(0);
    expect(t1(12)?.weight).toBe(round(60 * 0.9)); // 54
    expect(t1(12)?.sets).toBe(5);
    expect(t1(12)?.reps).toBe(3);
  });

  it('T2 advances through stages then adds 15kg on final fail', () => {
    const baseT2 = round(DEFAULT_WEIGHTS.bench * 0.65); // 26
    const results = toGenericResults([
      [0, { t2: 'fail' }],
      [4, { t2: 'fail' }],
      [8, { t2: 'fail' }],
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    const t2 = (i: number) => rows[i].slots.find((s) => s.tier === 't2');

    expect(t2(4)?.stage).toBe(1);
    expect(t2(4)?.weight).toBe(baseT2);
    expect(t2(8)?.stage).toBe(2);
    expect(t2(12)?.stage).toBe(0);
    expect(t2(12)?.weight).toBe(baseT2 + 15);
  });

  it('T1 success at stage 1 increases weight without changing stage', () => {
    const results = toGenericResults([
      [0, { t1: 'fail' }],
      [4, { t1: 'success' }],
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    expect(rows[8].slots.find((s) => s.tier === 't1')?.weight).toBe(65);
  });

  it('uses 2.5 increment for bench and ohp T1, 5 for squat and deadlift', () => {
    const results = toGenericResults([
      [1, { t1: 'success' }], // OHP
      [2, { t1: 'success' }], // Bench
      [0, { t1: 'success' }], // Squat
      [3, { t1: 'success' }], // Deadlift
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    expect(rows[5].slots.find((s) => s.tier === 't1')?.weight).toBe(27.5); // OHP +2.5
    expect(rows[6].slots.find((s) => s.tier === 't1')?.weight).toBe(42.5); // Bench +2.5
    expect(rows[4].slots.find((s) => s.tier === 't1')?.weight).toBe(65); // Squat +5
    expect(rows[7].slots.find((s) => s.tier === 't1')?.weight).toBe(85); // Deadlift +5
  });

  it('keeps all stages at 0 with all-success results', () => {
    const results = toGenericSuccessResults(90);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.stage).toBe(0);
      }
    }
  });

  it('preserves amrapReps in slot result', () => {
    const results = toGenericResults([
      [0, { t1: 'success', t1Reps: 8, t3: 'success', t3Reps: 30 }],
    ]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    expect(rows[0].slots.find((s) => s.tier === 't1')?.amrapReps).toBe(8);
    expect(rows[0].slots.find((s) => s.tier === 't3')?.amrapReps).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// advance_stage_add_weight rule
// ---------------------------------------------------------------------------
describe('advance_stage_add_weight rule', () => {
  it('advances stage AND adds weight on mid-stage fail', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
        { sets: 10, reps: 1 },
      ],
      onMidStageFail: { type: 'advance_stage_add_weight' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[1].slots[0].stage).toBe(1);
    expect(rows[1].slots[0].weight).toBe(105);
  });

  it('advances stage AND adds weight on explicit success', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = { '0': { slot1: { result: 'success' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[1].slots[0].stage).toBe(1);
    expect(rows[1].slots[0].weight).toBe(105);
  });

  it('uses the correct increment from weightIncrements', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 2.5,
    });
    const results: GenericResults = { '0': { slot1: { result: 'success' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[1].slots[0].weight).toBe(102.5);
  });

  it('clamps stage at maxStage when already at the top', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'success' } }, // stage 0 → 1
      '1': { slot1: { result: 'success' } }, // stage 1 → still 1 (clamped)
    };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[2].slots[0].stage).toBe(1); // maxStage = 1
    expect(rows[2].slots[0].weight).toBe(110); // 100 + 5 + 5
  });

  it('does NOT fire on final-stage fail (uses onFinalStageFail instead)', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }], // single stage, so any fail is final
      onMidStageFail: { type: 'advance_stage_add_weight' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[1].slots[0].stage).toBe(0); // no change
    expect(rows[1].slots[0].weight).toBe(100); // no change
  });

  it('marks isChanged=true when triggered by a fail', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onMidStageFail: { type: 'advance_stage_add_weight' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[1].slots[0].isChanged).toBe(true);
  });

  it('does NOT mark isChanged when triggered by implicit pass (onSuccess)', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const rows = computeGenericProgram(def, { ex: 100 }, {});

    expect(rows[1].slots[0].isChanged).toBe(false);
  });

  it('advances multiple stages across multiple workouts', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
        { sets: 10, reps: 1 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      weightIncrement: 5,
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'success' } }, // 100 → stage 1, weight 105
      '1': { slot1: { result: 'success' } }, // 105 → stage 2, weight 110
    };
    const rows = computeGenericProgram(def, { ex: 100 }, results);

    expect(rows[2].slots[0].stage).toBe(2);
    expect(rows[2].slots[0].weight).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// Isolated rule behaviors
// ---------------------------------------------------------------------------
describe('computeGenericProgram: isolated rules', () => {
  it('add_weight: increases weight by increment', () => {
    const def = makeDefinition({ onSuccess: { type: 'add_weight' }, weightIncrement: 5 });
    const results: GenericResults = { '0': { slot1: { result: 'success' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].weight).toBe(105);
  });

  it('add_weight: does not change stage', () => {
    const def = makeDefinition({ onSuccess: { type: 'add_weight' }, weightIncrement: 5 });
    const results: GenericResults = { '0': { slot1: { result: 'success' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].stage).toBe(0);
  });

  it('advance_stage: increments stage without changing weight', () => {
    const def = makeDefinition({
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].stage).toBe(1);
    expect(rows[1].slots[0].weight).toBe(100);
  });

  it('deload_percent: applies correct percentage and resets stage', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
        { sets: 10, reps: 1 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'deload_percent', percent: 10 },
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'fail' } }, // → stage 1
      '1': { slot1: { result: 'fail' } }, // → stage 2
      '2': { slot1: { result: 'fail' } }, // → deload 10%, stage 0
    };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[3].slots[0].stage).toBe(0);
    expect(rows[3].slots[0].weight).toBe(round(100 * 0.9)); // 90
  });

  it('deload_percent: does not produce negative weights', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onFinalStageFail: { type: 'deload_percent', percent: 99 },
      totalWorkouts: 20,
    });
    const allFail: GenericResults = {};
    for (let i = 0; i < 20; i++) {
      allFail[String(i)] = { slot1: { result: 'fail' } };
    }
    const rows = computeGenericProgram(def, { ex: 5 }, allFail);
    for (const row of rows) {
      expect(row.slots[0].weight).toBeGreaterThanOrEqual(0);
    }
  });

  it('add_weight_reset_stage: adds amount and resets stage to 0', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
        { sets: 10, reps: 1 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'fail' } }, // → stage 1
      '1': { slot1: { result: 'fail' } }, // → stage 2
      '2': { slot1: { result: 'fail' } }, // → +15, stage 0
    };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[3].slots[0].stage).toBe(0);
    expect(rows[3].slots[0].weight).toBe(round(100 + 15)); // 115
  });

  it('no_change: neither weight nor stage changes on fail', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].stage).toBe(0);
    expect(rows[1].slots[0].weight).toBe(100);
  });

  it('onUndefined: overrides implicit pass when defined', () => {
    const def = makeDefinition({
      onSuccess: { type: 'add_weight' },
      onUndefined: { type: 'no_change' },
      weightIncrement: 5,
    });
    // No results → triggers onUndefined path
    const rows = computeGenericProgram(def, { ex: 100 }, {});
    // All workouts should have weight=100 since implicit pass uses no_change
    for (const row of rows) {
      expect(row.slots[0].weight).toBe(100);
    }
  });

  it('implicit pass uses onSuccess when onUndefined is not set', () => {
    const def = makeDefinition({
      onSuccess: { type: 'add_weight' },
      weightIncrement: 5,
    });
    const rows = computeGenericProgram(def, { ex: 100 }, {});
    // Each workout adds 5
    expect(rows[1].slots[0].weight).toBe(105);
    expect(rows[2].slots[0].weight).toBe(110);
  });

  it('sets/reps reflect the active stage', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
        { sets: 10, reps: 1 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'fail' } }, // → stage 1
      '1': { slot1: { result: 'fail' } }, // → stage 2
    };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[0].slots[0].sets).toBe(5);
    expect(rows[0].slots[0].reps).toBe(3);
    expect(rows[1].slots[0].sets).toBe(6);
    expect(rows[1].slots[0].reps).toBe(2);
    expect(rows[2].slots[0].sets).toBe(10);
    expect(rows[2].slots[0].reps).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isChanged semantics
// ---------------------------------------------------------------------------
describe('computeGenericProgram: isChanged semantics', () => {
  it('isChanged=false before any failure', () => {
    const def = makeDefinition({});
    const rows = computeGenericProgram(def, { ex: 100 }, {});
    expect(rows[0].slots[0].isChanged).toBe(false);
  });

  it('isChanged=true after a fail that changes state (advance_stage)', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].isChanged).toBe(true);
  });

  it('isChanged=true after a fail that changes state (add_weight_reset_stage)', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].isChanged).toBe(true);
  });

  it('isChanged=false after a fail with no_change rule', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].slots[0].isChanged).toBe(false);
  });

  it('everChanged persists once set', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    // All subsequent rows should have isChanged=true even without further failures
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].slots[0].isChanged).toBe(true);
    }
  });

  it('GenericWorkoutRow.isChanged is true when any slot isChanged', () => {
    const def = makeDefinition({
      stages: [
        { sets: 5, reps: 3 },
        { sets: 6, reps: 2 },
      ],
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'no_change' },
    });
    const results: GenericResults = { '0': { slot1: { result: 'fail' } } };
    const rows = computeGenericProgram(def, { ex: 100 }, results);
    expect(rows[1].isChanged).toBe(true);
  });

  it('GZCLP parity: T3 fail does NOT affect row isChanged', () => {
    // T3 fail uses no_change → changesState=false → slot isChanged stays false
    const results = toGenericResults([[0, { t3: 'fail' }]]);
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
    // The workout with T3 fail
    const t3Slot = rows[0].slots.find((s) => s.tier === 't3');
    expect(t3Slot?.result).toBe('fail');
    // Next workout's T3 slot should still have isChanged=false
    const nextT3 = rows[2].slots.find((s) => s.tier === 't3');
    expect(nextT3?.isChanged).toBe(false);
    // Row itself: isChanged tracks T1+T2, not T3
    expect(rows[1].isChanged).toBe(false);
  });

  it('GZCLP parity: T1 fail marks its exercise changed but not others', () => {
    const results = toGenericResults([[0, { t1: 'fail' }]]); // squat T1 fails
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

    // Next squat T1 appearance (workout 4) should be changed
    expect(rows[4].isChanged).toBe(true);
    // OHP on Day 2 should not be affected
    expect(rows[1].isChanged).toBe(false);
    // Bench on Day 3 should not be affected
    expect(rows[2].isChanged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.1 — TM initialization tests (REQ-ENGINE-001)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: TM initialization', () => {
  it('initializes TM from config for a single TM key (REQ-ENGINE-001 scenario 1)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const rows = computeGenericProgram(def, { squat_tm: 100 }, {});

    expect(rows[0].slots[0].weight).toBe(round(100 * 0.85));
  });

  it('initializes TM to 0 when key missing from config (REQ-ENGINE-001 scenario 2)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'bench_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const rows = computeGenericProgram(def, {}, {});

    expect(rows[0].slots[0].weight).toBe(0);
  });

  it('non-TM slots are unaffected by TM initialization (REQ-ENGINE-001 scenario 3)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
      extraSlots: [
        {
          id: 'abs_slot',
          exerciseId: 'ex2',
          tier: 't3',
          stages: [{ sets: 3, reps: 8 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'ex2',
        },
      ],
      extraExercises: { ex2: { name: 'Exercise 2' } },
      extraIncrements: { ex2: 2.5 },
      extraConfigFields: [
        { key: 'ex2', label: 'Exercise 2', type: 'weight' as const, min: 0, step: 2.5 },
      ],
    });
    const rows = computeGenericProgram(def, { squat_tm: 100, ex2: 80 }, {});

    expect(rows[0].slots[1].weight).toBe(80);
    expect(rows[0].slots[0].weight).toBe(round(100 * 0.85));
  });
});

// ---------------------------------------------------------------------------
// 4.2 — TM weight computation tests (REQ-ENGINE-002)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: TM weight computation', () => {
  it('computes TM slot weight at 75% (REQ-ENGINE-002 scenario 1)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5 }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.75,
      role: 'secondary',
    });
    const rows = computeGenericProgram(def, { squat_tm: 100 }, {});

    expect(rows[0].slots[0].weight).toBe(75);
  });

  it('computes TM slot weight at 85% (REQ-ENGINE-002 scenario 2)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const rows = computeGenericProgram(def, { squat_tm: 100 }, {});

    expect(rows[0].slots[0].weight).toBe(85);
  });

  it('two slots sharing same TM key reflect the same TM (REQ-ENGINE-002 scenario 3)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
      extraSlots: [
        {
          id: 'squat_sec',
          exerciseId: 'ex',
          tier: 'secondary',
          stages: [{ sets: 3, reps: 5 }],
          onSuccess: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat_tm',
          trainingMaxKey: 'squat_tm',
          tmPercent: 0.75,
          role: 'secondary',
        },
      ],
    });
    const rows = computeGenericProgram(def, { squat_tm: 100 }, {});

    expect(rows[0].slots[0].weight).toBe(85);
    expect(rows[0].slots[1].weight).toBe(75);
  });

  it('applies roundToNearestHalf to TM-derived weight (REQ-ENGINE-002 scenario 4)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'bench_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const rows = computeGenericProgram(def, { bench_tm: 92.5 }, {});

    // 92.5 * 0.85 = 78.625 → roundToNearestHalf → 78.5
    expect(rows[0].slots[0].weight).toBe(78.5);
  });
});

// ---------------------------------------------------------------------------
// 4.3 — update_tm progression tests (REQ-ENGINE-003)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: update_tm progression', () => {
  it('TM increases when AMRAP meets minimum (REQ-ENGINE-003 scenario 1)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'success', amrapReps: 6 } },
    };
    const rows = computeGenericProgram(def, { squat_tm: 100 }, results);

    // TM goes from 100 to 105, next workout weight = round(105 * 0.85) = 89 (89.25 rounds to 89)
    expect(rows[1].slots[0].weight).toBe(round(105 * 0.85));
  });

  it('TM does not increase when AMRAP falls short (REQ-ENGINE-003 scenario 2)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'success', amrapReps: 3 } },
    };
    const rows = computeGenericProgram(def, { squat_tm: 100 }, results);

    // TM stays at 100
    expect(rows[1].slots[0].weight).toBe(round(100 * 0.85));
  });

  it('TM does not increase when amrapReps is undefined (REQ-ENGINE-003 scenario 3)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
    });
    const results: GenericResults = {
      '0': { slot1: { result: 'success' } },
    };
    const rows = computeGenericProgram(def, { squat_tm: 100 }, results);

    // TM stays at 100
    expect(rows[1].slots[0].weight).toBe(round(100 * 0.85));
  });

  it('update_tm on slot without trainingMaxKey throws (REQ-ENGINE-003 scenario 5)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      // No trainingMaxKey set — override startWeightKey back to 'ex'
    });

    // Need to manually construct to have update_tm without trainingMaxKey
    const broken: ProgramDefinition = {
      ...def,
      days: [
        {
          name: 'Day 1',
          slots: [
            {
              id: 'slot1',
              exerciseId: 'ex',
              tier: 't1',
              stages: [{ sets: 1, reps: 5, amrap: true }],
              onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'ex',
              // trainingMaxKey intentionally missing
            },
          ],
        },
      ],
    };
    const results: GenericResults = {
      '0': { slot1: { result: 'success', amrapReps: 6 } },
    };

    expect(() => computeGenericProgram(broken, { ex: 100 }, results)).toThrow(
      'update_tm rule requires trainingMaxKey'
    );
  });
});

// ---------------------------------------------------------------------------
// 4.4 — repsMax pass-through tests (REQ-ENGINE-004)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: repsMax pass-through', () => {
  it('stage with repsMax emits repsMax in GenericSlotRow (REQ-ENGINE-004 scenario 1)', () => {
    const def = makeDefinition({
      stages: [{ sets: 3, reps: 8, repsMax: 10 }],
      onSuccess: { type: 'advance_stage' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
    });
    const rows = computeGenericProgram(def, { ex: 50 }, {});

    expect(rows[0].slots[0].reps).toBe(8);
    expect(rows[0].slots[0].repsMax).toBe(10);
  });

  it('stage without repsMax emits undefined repsMax (REQ-ENGINE-004 scenario 2)', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
    });
    const rows = computeGenericProgram(def, { ex: 50 }, {});

    expect(rows[0].slots[0].reps).toBe(3);
    expect(rows[0].slots[0].repsMax).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4.5 — Role emission tests (REQ-ENGINE-005)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: role emission', () => {
  it('slot with explicit role "primary" emits that role (REQ-ENGINE-005 scenario 1)', () => {
    const def = makeDefinition({
      tier: 'main',
      role: 'primary',
      stages: [{ sets: 1, reps: 5 }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
    });
    const rows = computeGenericProgram(def, { ex: 100 }, {});

    expect(rows[0].slots[0].role).toBe('primary');
  });

  it('legacy GZCLP t1 slot synthesizes "primary" (REQ-ENGINE-005 scenario 2)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    const t1Slot = rows[0].slots.find((s) => s.tier === 't1');

    expect(t1Slot?.role).toBe('primary');
  });

  it('legacy GZCLP t2 slot synthesizes "secondary" (REQ-ENGINE-005 scenario 3)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    const t2Slot = rows[0].slots.find((s) => s.tier === 't2');

    expect(t2Slot?.role).toBe('secondary');
  });

  it('legacy GZCLP t3 slot synthesizes "primary" (REQ-ENGINE-005 scenario 4)', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});
    const t3Slot = rows[0].slots.find((s) => s.tier === 't3');

    expect(t3Slot?.role).toBe('primary');
  });

  it('unknown tier with no explicit role emits undefined role (REQ-ENGINE-005 scenario 5)', () => {
    const def = makeDefinition({
      tier: 'warmup',
      stages: [{ sets: 1, reps: 5 }],
      onSuccess: { type: 'no_change' },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
    });
    const rows = computeGenericProgram(def, { ex: 50 }, {});

    expect(rows[0].slots[0].role).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4.6 — Deterministic replay test (REQ-ENGINE-006)
// ---------------------------------------------------------------------------
describe('computeGenericProgram: deterministic replay', () => {
  it('same inputs produce identical output on repeated calls (REQ-ENGINE-006 scenario 1)', () => {
    const def = makeDefinition({
      stages: [{ sets: 1, reps: 5, amrap: true }],
      onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 5 },
      onMidStageFail: { type: 'no_change' },
      onFinalStageFail: { type: 'no_change' },
      trainingMaxKey: 'squat_tm',
      tmPercent: 0.85,
      role: 'primary',
      totalWorkouts: 6,
    });
    const config = { squat_tm: 100 };
    const results: GenericResults = {
      '0': { slot1: { result: 'success', amrapReps: 6 } },
      '2': { slot1: { result: 'success', amrapReps: 5 } },
      '4': { slot1: { result: 'success', amrapReps: 3 } },
    };

    const run1 = computeGenericProgram(def, config, results);
    const run2 = computeGenericProgram(def, config, results);

    expect(run1).toEqual(run2);
  });
});

// ---------------------------------------------------------------------------
// 4.7 — Schema validation tests (REQ-SCHEMA-001 through REQ-SCHEMA-005)
// ---------------------------------------------------------------------------
describe('Schema validation: new fields', () => {
  /** Minimal valid slot for schema testing. */
  const validSlot = {
    id: 'slot1',
    exerciseId: 'ex',
    tier: 't1',
    stages: [{ sets: 5, reps: 3 }],
    onSuccess: { type: 'add_weight' },
    onMidStageFail: { type: 'advance_stage' },
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    startWeightKey: 'ex',
  };

  // REQ-SCHEMA-004: UpdateTm progression rule
  it('update_tm rule with valid fields parses (REQ-SCHEMA-004 scenario 1)', () => {
    const rule = { type: 'update_tm', amount: 2.5, minAmrapReps: 5 };
    const parsed = ProgressionRuleSchema.parse(rule);

    expect(parsed.type).toBe('update_tm');
    if (parsed.type === 'update_tm') {
      expect(parsed.amount).toBe(2.5);
      expect(parsed.minAmrapReps).toBe(5);
    }
  });

  it('update_tm rule missing amount is rejected (REQ-SCHEMA-004 scenario 2)', () => {
    const rule = { type: 'update_tm', minAmrapReps: 5 };

    expect(() => ProgressionRuleSchema.parse(rule)).toThrow();
  });

  it('update_tm with negative minAmrapReps is rejected (REQ-SCHEMA-004 scenario 3)', () => {
    const rule = { type: 'update_tm', amount: 2.5, minAmrapReps: -1 };

    expect(() => ProgressionRuleSchema.parse(rule)).toThrow();
  });

  it('existing rule types still parse (REQ-SCHEMA-004 scenario 4)', () => {
    const rule = { type: 'add_weight' };
    const parsed = ProgressionRuleSchema.parse(rule);

    expect(parsed.type).toBe('add_weight');
  });

  // REQ-SCHEMA-001: trainingMaxKey and tmPercent on ExerciseSlot
  it('slot with trainingMaxKey and tmPercent parses (REQ-SCHEMA-001 scenario 1)', () => {
    const slot = { ...validSlot, trainingMaxKey: 'squat_tm', tmPercent: 0.85 };
    const parsed = ExerciseSlotSchema.parse(slot);

    expect(parsed.trainingMaxKey).toBe('squat_tm');
    expect(parsed.tmPercent).toBe(0.85);
  });

  it('tmPercent: 0 rejected (REQ-SCHEMA-001 scenario 3)', () => {
    const slot = { ...validSlot, tmPercent: 0 };

    expect(() => ExerciseSlotSchema.parse(slot)).toThrow();
  });

  it('tmPercent: 1.1 rejected (REQ-SCHEMA-001 scenario 4)', () => {
    const slot = { ...validSlot, tmPercent: 1.1 };

    expect(() => ExerciseSlotSchema.parse(slot)).toThrow();
  });

  // REQ-SCHEMA-002: role field on ExerciseSlot
  it('role: "primary" on slot parses (REQ-SCHEMA-002 scenario 1)', () => {
    const slot = { ...validSlot, role: 'primary' };
    const parsed = ExerciseSlotSchema.parse(slot);

    expect(parsed.role).toBe('primary');
  });

  it('role: "tertiary" rejected (REQ-SCHEMA-002 scenario 4)', () => {
    const slot = { ...validSlot, role: 'tertiary' };

    expect(() => ExerciseSlotSchema.parse(slot)).toThrow();
  });

  // REQ-SCHEMA-003: repsMax on StageDefinition
  it('repsMax on stage parses (REQ-SCHEMA-003 scenario 1)', () => {
    const stage = { sets: 3, reps: 8, repsMax: 10 };
    const parsed = StageDefinitionSchema.parse(stage);

    expect(parsed.repsMax).toBe(10);
  });

  it('repsMax: 0 rejected (REQ-SCHEMA-003 scenario 3)', () => {
    const stage = { sets: 3, reps: 8, repsMax: 0 };

    expect(() => StageDefinitionSchema.parse(stage)).toThrow();
  });

  // REQ-SCHEMA-005: TierSchema relaxed to open string
  it('tier: "main" parses (REQ-SCHEMA-005 scenario 2)', () => {
    const slot = { ...validSlot, tier: 'main' };
    const parsed = ExerciseSlotSchema.parse(slot);

    expect(parsed.tier).toBe('main');
  });

  it('empty string tier rejected (REQ-SCHEMA-005 scenario 3)', () => {
    const slot = { ...validSlot, tier: '' };

    expect(() => ExerciseSlotSchema.parse(slot)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isDeload detection (REQ-DI-001)
// ---------------------------------------------------------------------------

describe('computeGenericProgram — isDeload', () => {
  it('first occurrence of an exercise has isDeload=false', () => {
    const def = makeDefinition({ totalWorkouts: 1 });
    const results: GenericResults = {};

    const rows = computeGenericProgram(def, { ex: 60 }, results);

    expect(rows[0].slots[0].isDeload).toBe(false);
  });

  it('slot where weight decreases from previous occurrence has isDeload=true', () => {
    // 2 workouts: first succeeds (weight 60), second at 60+5=65
    // Then we need a fail that triggers deload. Use deload_percent on final stage fail.
    // Single stage: fail at stage 0 = final stage → deload 10% → 60 * 0.9 = 54
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onSuccess: { type: 'add_weight' },
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'deload_percent', percent: 10 },
      weightIncrement: 5,
      totalWorkouts: 3,
    });

    const results: GenericResults = {
      '0': { slot1: { result: 'success' } }, // Weight 60 → next 65
      '1': { slot1: { result: 'fail' } }, // Weight 65, fail → deload to 58.5
    };

    const rows = computeGenericProgram(def, { ex: 60 }, results);

    // Workout 0: weight=60, isDeload=false (first occurrence)
    expect(rows[0].slots[0].isDeload).toBe(false);
    // Workout 1: weight=65 (increased), isDeload=false
    expect(rows[1].slots[0].isDeload).toBe(false);
    // Workout 2: weight=58.5 (decreased from 65), isDeload=true
    expect(rows[2].slots[0].isDeload).toBe(true);
  });

  it('slot where weight increases has isDeload=false', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onSuccess: { type: 'add_weight' },
      weightIncrement: 5,
      totalWorkouts: 2,
    });

    const results: GenericResults = {
      '0': { slot1: { result: 'success' } },
    };

    const rows = computeGenericProgram(def, { ex: 60 }, results);

    // Workout 1: weight=65 (increased from 60), isDeload=false
    expect(rows[1].slots[0].isDeload).toBe(false);
  });

  it('slot where weight stays the same has isDeload=false', () => {
    const def = makeDefinition({
      stages: [{ sets: 5, reps: 3 }],
      onSuccess: { type: 'no_change' },
      totalWorkouts: 2,
    });

    const results: GenericResults = {
      '0': { slot1: { result: 'success' } },
    };

    const rows = computeGenericProgram(def, { ex: 60 }, results);

    // Workout 1: weight=60 (same), isDeload=false
    expect(rows[1].slots[0].isDeload).toBe(false);
  });

  it('bodyweight slot (weight=0) has isDeload=false even when prior had weight > 0', () => {
    // Start at weight=0 (bodyweight exercise)
    const def = makeDefinition({
      stages: [{ sets: 3, reps: 10 }],
      onSuccess: { type: 'no_change' },
      totalWorkouts: 2,
    });

    const results: GenericResults = {};

    const rows = computeGenericProgram(def, { ex: 0 }, results);

    expect(rows[0].slots[0].weight).toBe(0);
    expect(rows[0].slots[0].isDeload).toBe(false);
    expect(rows[1].slots[0].weight).toBe(0);
    expect(rows[1].slots[0].isDeload).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Notes pass-through tests
// ---------------------------------------------------------------------------

describe('notes pass-through', () => {
  it('slot with notes passes through to GenericSlotRow.notes', () => {
    const def = makeDefinition({
      stages: [{ sets: 3, reps: 5 }],
      onSuccess: { type: 'no_change' },
      totalWorkouts: 1,
    });
    // Inject notes directly on the slot
    (def.days[0].slots[0] as Record<string, unknown>).notes = 'Test note content';

    const rows = computeGenericProgram(def, { ex: 60 }, {});

    expect(rows[0].slots[0].notes).toBe('Test note content');
  });

  it('slot without notes has GenericSlotRow.notes as undefined', () => {
    const def = makeDefinition({
      stages: [{ sets: 3, reps: 5 }],
      onSuccess: { type: 'no_change' },
      totalWorkouts: 1,
    });

    const rows = computeGenericProgram(def, { ex: 60 }, {});

    expect(rows[0].slots[0].notes).toBeUndefined();
  });

  it('ExerciseSlotSchema validates slot with notes present', () => {
    const slot = {
      id: 'test',
      exerciseId: 'squat',
      tier: 't1',
      stages: [{ sets: 3, reps: 5 }],
      onSuccess: { type: 'no_change' as const },
      onMidStageFail: { type: 'no_change' as const },
      onFinalStageFail: { type: 'no_change' as const },
      startWeightKey: 'squat',
      notes: 'Some instruction here',
    };

    const result = ExerciseSlotSchema.safeParse(slot);

    expect(result.success).toBe(true);
  });

  it('ExerciseSlotSchema validates slot without notes (backwards compat)', () => {
    const slot = {
      id: 'test',
      exerciseId: 'squat',
      tier: 't1',
      stages: [{ sets: 3, reps: 5 }],
      onSuccess: { type: 'no_change' as const },
      onMidStageFail: { type: 'no_change' as const },
      onFinalStageFail: { type: 'no_change' as const },
      startWeightKey: 'squat',
    };

    const result = ExerciseSlotSchema.safeParse(slot);

    expect(result.success).toBe(true);
  });

  it('ExerciseSlotSchema rejects slot with notes: empty string (min 1 char)', () => {
    const slot = {
      id: 'test',
      exerciseId: 'squat',
      tier: 't1',
      stages: [{ sets: 3, reps: 5 }],
      onSuccess: { type: 'no_change' as const },
      onMidStageFail: { type: 'no_change' as const },
      onFinalStageFail: { type: 'no_change' as const },
      startWeightKey: 'squat',
      notes: '',
    };

    const result = ExerciseSlotSchema.safeParse(slot);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.5 — ConfigFieldSchema tests
// ---------------------------------------------------------------------------

describe('ConfigFieldSchema', () => {
  it('validates weight-type field (backwards compat)', () => {
    const field = {
      key: 'squat',
      label: 'Sentadilla',
      type: 'weight' as const,
      min: 2.5,
      step: 2.5,
    };

    const result = ConfigFieldSchema.safeParse(field);

    expect(result.success).toBe(true);
  });

  it('validates select-type field', () => {
    const field = {
      key: 'gender',
      label: 'Gender',
      type: 'select' as const,
      options: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
      ],
    };

    const result = ConfigFieldSchema.safeParse(field);

    expect(result.success).toBe(true);
  });

  it('rejects select field with empty options array', () => {
    const field = {
      key: 'gender',
      label: 'Gender',
      type: 'select' as const,
      options: [],
    };

    const result = ConfigFieldSchema.safeParse(field);

    expect(result.success).toBe(false);
  });

  it('rejects select field missing options', () => {
    const field = {
      key: 'gender',
      label: 'Gender',
      type: 'select' as const,
    };

    const result = ConfigFieldSchema.safeParse(field);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.6 — ProgramDefinitionSchema tests
// ---------------------------------------------------------------------------

describe('ProgramDefinitionSchema', () => {
  /** Hydrate a seed definition's exercises map so it passes schema validation. */
  function hydrateExercises<T extends { exercises: Record<string, Record<string, never>> }>(
    def: T
  ): T & { exercises: Record<string, { name: string }> } {
    return {
      ...def,
      exercises: Object.fromEntries(Object.keys(def.exercises).map((id) => [id, { name: id }])),
    } as T & { exercises: Record<string, { name: string }> };
  }

  it('validates with displayMode: blocks', () => {
    const def = {
      id: 'test',
      name: 'Test',
      description: 'test',
      author: 'test',
      version: 1,
      category: 'test',
      source: 'preset' as const,
      cycleLength: 1,
      totalWorkouts: 1,
      workoutsPerWeek: 1,
      exercises: { ex: { name: 'Exercise' } },
      configFields: [{ key: 'ex', label: 'Ex', type: 'weight' as const, min: 0, step: 2.5 }],
      weightIncrements: { ex: 5 },
      days: [
        {
          name: 'Day 1',
          slots: [
            {
              id: 's1',
              exerciseId: 'ex',
              tier: 't1',
              stages: [{ sets: 3, reps: 5 }],
              onSuccess: { type: 'no_change' as const },
              onMidStageFail: { type: 'no_change' as const },
              onFinalStageFail: { type: 'no_change' as const },
              startWeightKey: 'ex',
            },
          ],
        },
      ],
      displayMode: 'blocks' as const,
    };

    const result = ProgramDefinitionSchema.safeParse(def);

    expect(result.success).toBe(true);
  });

  it('validates without displayMode', () => {
    const def = {
      id: 'test',
      name: 'Test',
      description: 'test',
      author: 'test',
      version: 1,
      category: 'test',
      source: 'preset' as const,
      cycleLength: 1,
      totalWorkouts: 1,
      workoutsPerWeek: 1,
      exercises: { ex: { name: 'Exercise' } },
      configFields: [{ key: 'ex', label: 'Ex', type: 'weight' as const, min: 0, step: 2.5 }],
      weightIncrements: { ex: 5 },
      days: [
        {
          name: 'Day 1',
          slots: [
            {
              id: 's1',
              exerciseId: 'ex',
              tier: 't1',
              stages: [{ sets: 3, reps: 5 }],
              onSuccess: { type: 'no_change' as const },
              onMidStageFail: { type: 'no_change' as const },
              onFinalStageFail: { type: 'no_change' as const },
              startWeightKey: 'ex',
            },
          ],
        },
      ],
    };

    const result = ProgramDefinitionSchema.safeParse(def);

    expect(result.success).toBe(true);
  });

  it('rejects displayMode: carousel', () => {
    const def = {
      id: 'test',
      name: 'Test',
      description: 'test',
      author: 'test',
      version: 1,
      category: 'test',
      source: 'preset' as const,
      cycleLength: 1,
      totalWorkouts: 1,
      workoutsPerWeek: 1,
      exercises: { ex: { name: 'Exercise' } },
      configFields: [{ key: 'ex', label: 'Ex', type: 'weight' as const, min: 0, step: 2.5 }],
      weightIncrements: { ex: 5 },
      days: [
        {
          name: 'Day 1',
          slots: [
            {
              id: 's1',
              exerciseId: 'ex',
              tier: 't1',
              stages: [{ sets: 3, reps: 5 }],
              onSuccess: { type: 'no_change' as const },
              onMidStageFail: { type: 'no_change' as const },
              onFinalStageFail: { type: 'no_change' as const },
              startWeightKey: 'ex',
            },
          ],
        },
      ],
      displayMode: 'carousel',
    };

    const result = ProgramDefinitionSchema.safeParse(def);

    expect(result.success).toBe(false);
  });

  describe('all existing program definitions pass ProgramDefinitionSchema.safeParse', () => {
    /**
     * Seed JSONB definitions only contain the engine payload (days, configFields, etc.).
     * Metadata fields (id, name, description, author, version, category, source) are
     * stored as separate DB columns in the template seed. We merge both here to produce
     * a full ProgramDefinition for schema validation.
     */
    const definitions = [
      {
        name: 'GZCLP',
        def: GZCLP_DEFINITION_JSONB,
        meta: {
          id: 'gzclp',
          name: 'GZCLP',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'PPL 5/3/1',
        def: PPL531_DEFINITION_JSONB,
        meta: {
          id: 'ppl531',
          name: 'PPL',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'hypertrophy',
          source: 'preset' as const,
        },
      },
      {
        name: 'StrongLifts',
        def: STRONGLIFTS_DEFINITION_JSONB,
        meta: {
          id: 'stronglifts',
          name: 'SL',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'Greyskull',
        def: GSLP_DEFINITION_JSONB,
        meta: {
          id: 'gslp',
          name: 'GSLP',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'BBB',
        def: BBB_DEFINITION_JSONB,
        meta: {
          id: 'bbb',
          name: 'BBB',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'FSL 5/3/1',
        def: FSL531_DEFINITION_JSONB,
        meta: {
          id: 'fsl531',
          name: 'FSL',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'PHUL',
        def: PHUL_DEFINITION_JSONB,
        meta: {
          id: 'phul',
          name: 'PHUL',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'hypertrophy',
          source: 'preset' as const,
        },
      },
      {
        name: 'Nivel 7',
        def: NIVEL7_DEFINITION_JSONB,
        meta: {
          id: 'nivel7',
          name: 'Nivel7',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'strength',
          source: 'preset' as const,
        },
      },
      {
        name: 'Brunetti 365',
        def: BRUNETTI365_DEFINITION_JSONB,
        meta: {
          id: 'brunetti-365',
          name: '365',
          description: 'test',
          author: 'test',
          version: 1,
          category: 'hypertrophy',
          source: 'preset' as const,
        },
      },
      {
        name: 'MUTENROSHI',
        def: MUTENROSHI_DEFINITION_JSONB,
        meta: {}, // MUTENROSHI already has all metadata fields
      },
    ];

    for (const { name, def, meta } of definitions) {
      it(`${name} passes schema validation`, () => {
        const merged = { ...meta, ...def };
        const hydrated = {
          ...merged,
          exercises: Object.fromEntries(
            Object.keys(merged.exercises as Record<string, unknown>).map((id) => [id, { name: id }])
          ),
        };
        const result = ProgramDefinitionSchema.safeParse(hydrated);

        if (!result.success) {
          console.error(`${name} failed:`, JSON.stringify(result.error.issues, null, 2));
        }
        expect(result.success).toBe(true);
      });
    }
  });

  it('computeGenericProgram with MUTENROSHI (200 workouts) completes in < 100ms', () => {
    const hydrated = hydrateExercises(
      MUTENROSHI_DEFINITION_JSONB as Record<string, unknown> as typeof MUTENROSHI_DEFINITION_JSONB
    );
    const config: Record<string, number | string> = {
      bodyweight: 80,
      gender: 'male',
      rounding: '2.5',
      squat_start: 20,
      bench_start: 20,
      deadlift_start: 20,
    };

    const start = performance.now();
    const rows = computeGenericProgram(hydrated as unknown as ProgramDefinition, config, {});
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(200);
    expect(elapsed).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 4.7 — MUTENROSHI engine integration tests
// ---------------------------------------------------------------------------

describe('MUTENROSHI engine integration', () => {
  function hydrateExercises<T extends { exercises: Record<string, Record<string, never>> }>(
    def: T
  ): T & { exercises: Record<string, { name: string }> } {
    return {
      ...def,
      exercises: Object.fromEntries(Object.keys(def.exercises).map((id) => [id, { name: id }])),
    } as T & { exercises: Record<string, { name: string }> };
  }

  const hydrated = hydrateExercises(
    MUTENROSHI_DEFINITION_JSONB as Record<string, unknown> as typeof MUTENROSHI_DEFINITION_JSONB
  );
  const config: Record<string, number | string> = {
    bodyweight: 80,
    gender: 'male',
    rounding: '2.5',
    squat_start: 20,
    bench_start: 20,
    deadlift_start: 20,
  };
  const rows = computeGenericProgram(hydrated as unknown as ProgramDefinition, config, {});

  it('returns exactly 200 GenericWorkoutRow entries', () => {
    expect(rows).toHaveLength(200);
  });

  it('days 0-11 use bodyweight fundamentals', () => {
    const bodyweightExercises = new Set([
      'squat_bodyweight',
      'bench_pushups',
      'deadlift_isometric',
    ]);

    for (let i = 0; i < 12; i++) {
      const fundamentalSlots = rows[i].slots.filter((s) => s.tier === 'fundamental');

      expect(fundamentalSlots.length).toBeGreaterThan(0);
      for (const slot of fundamentalSlots) {
        expect(bodyweightExercises.has(slot.exerciseId)).toBe(true);
      }
    }
  });

  it('days 12+ use loaded fundamentals', () => {
    const loadedExercises = new Set(['squat_barbell', 'bench_press_barbell', 'deadlift_barbell']);

    for (let i = 12; i < 200; i++) {
      const fundamentalSlots = rows[i].slots.filter((s) => s.tier === 'fundamental');

      expect(fundamentalSlots.length).toBeGreaterThan(0);
      for (const slot of fundamentalSlots) {
        expect(loadedExercises.has(slot.exerciseId)).toBe(true);
      }
    }
  });
});
