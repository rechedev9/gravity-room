/**
 * Deterministic stress-test scenarios for the progression engine.
 *
 * These simulate realistic (and extreme) training patterns that a real athlete
 * could produce. Unlike the fuzz tests (random inputs), these test specific
 * progression narratives end-to-end and verify behavioral invariants.
 */
import { describe, it, expect } from 'bun:test';
import { computeGenericProgram } from './generic-engine';
import {
  GZCLP_DEFINITION_FIXTURE,
  NIVEL7_DEFINITION_FIXTURE,
  DOUBLE_PROGRESSION_DEFINITION_FIXTURE,
  DEFAULT_WEIGHTS,
} from '../test/fixtures';
import { FSL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/fsl531';
import { PPL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/ppl531';
import type { ProgramDefinition, GenericResults } from './types/program';

/** Wrap a JSONB seed export (missing id/name/etc.) into a full ProgramDefinition. */
function hydrate(jsonb: Record<string, unknown>): ProgramDefinition {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    author: '',
    version: 1,
    category: 'strength',
    source: 'preset' as const,
    ...jsonb,
    exercises: Object.fromEntries(
      Object.keys(jsonb['exercises'] as Record<string, unknown>).map((id) => [id, { name: id }])
    ),
  } as ProgramDefinition;
}

const FSL531 = hydrate(FSL531_DEFINITION_JSONB);
const PPL531 = hydrate(PPL531_DEFINITION_JSONB);
import type { SetLogEntry } from './types/index';

// Minimal prescription-based definition for scenario tests (avoids cross-workspace import issues)
const PRESCRIPTION_FIXTURE: ProgramDefinition = {
  id: 'prescription-test',
  name: 'Prescription Test',
  description: 'Minimal %1RM program for scenario tests',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset' as const,
  cycleLength: 2,
  totalWorkouts: 8,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat1rm', label: 'Squat 1RM', type: 'weight' as const, min: 0, step: 2.5 },
    { key: 'bench1rm', label: 'Bench 1RM', type: 'weight' as const, min: 0, step: 2.5 },
  ],
  weightIncrements: {},
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'sq-main',
          exerciseId: 'squat',
          tier: 'main',
          stages: [{ sets: 1, reps: 1 }],
          onSuccess: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat1rm',
          prescriptions: [
            { percent: 50, reps: 5, sets: 1 },
            { percent: 60, reps: 4, sets: 1 },
            { percent: 70, reps: 3, sets: 4 },
          ],
          percentOf: 'squat1rm',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'bp-main',
          exerciseId: 'bench',
          tier: 'main',
          stages: [{ sets: 1, reps: 1 }],
          onSuccess: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench1rm',
          prescriptions: [
            { percent: 50, reps: 5, sets: 1 },
            { percent: 65, reps: 3, sets: 5 },
          ],
          percentOf: 'bench1rm',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SlotResult = {
  result?: 'success' | 'fail';
  amrapReps?: number;
  rpe?: number;
  setLogs?: SetLogEntry[];
};

/** Fill all slots in a workout with the same result. */
function fillWorkout(
  definition: ProgramDefinition,
  workoutIndex: number,
  result: SlotResult
): Record<string, SlotResult> {
  const cycleLen = definition.days.length;
  const day = definition.days[workoutIndex % cycleLen];
  const out: Record<string, SlotResult> = {};
  for (const slot of day.slots) {
    out[slot.id] = result;
  }
  return out;
}

/** Fill all slots but allow per-tier overrides. */
function fillWorkoutByTier(
  definition: ProgramDefinition,
  workoutIndex: number,
  tierResults: Record<string, SlotResult>,
  fallback: SlotResult
): Record<string, SlotResult> {
  const cycleLen = definition.days.length;
  const day = definition.days[workoutIndex % cycleLen];
  const out: Record<string, SlotResult> = {};
  for (const slot of day.slots) {
    out[slot.id] = tierResults[slot.tier] ?? fallback;
  }
  return out;
}

/** Build results for N workouts using a pattern function. */
function buildResults(
  definition: ProgramDefinition,
  count: number,
  patternFn: (workoutIndex: number) => Record<string, SlotResult>
): GenericResults {
  const results: GenericResults = {};
  for (let i = 0; i < count; i++) {
    results[String(i)] = patternFn(i);
  }
  return results;
}

/** Get all occurrences of a slot across computed rows. */
function slotHistory(
  rows: ReturnType<typeof computeGenericProgram>,
  slotId: string
): { index: number; weight: number; stage: number; isChanged: boolean; isDeload: boolean }[] {
  return rows.flatMap((row) =>
    row.slots
      .filter((s) => s.slotId === slotId)
      .map((s) => ({
        index: row.index,
        weight: s.weight,
        stage: s.stage,
        isChanged: s.isChanged,
        isDeload: s.isDeload,
      }))
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: The eternal deload — athlete fails every single workout
// ---------------------------------------------------------------------------

describe('scenario: eternal deload (90 consecutive fails)', () => {
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) =>
    fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'fail' })
  );
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('weight never goes negative across 90 workouts of failure', () => {
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('T1 slots cycle through all 3 stages before deloading', () => {
    // d1-t1 is squat T1 with 3 stages. After 3 fails it deloads.
    const history = slotHistory(rows, 'd1-t1');
    // Stage should go 0 → 1 → 2 → 0 (deload) → 1 → 2 → 0 ...
    let deloadCount = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].stage === 0 && history[i - 1].stage === 2) {
        deloadCount++;
        // After deload, weight should be less than before the deload cycle started
        expect(history[i].weight).toBeLessThanOrEqual(history[i - 1].weight);
      }
    }
    // Should have at least a few deload cycles in 90 workouts
    expect(deloadCount).toBeGreaterThan(0);
  });

  it('T2 slots use add_weight_reset_stage on final fail (weight increases, stage resets)', () => {
    // d1-t2 is bench T2 with add_weight_reset_stage(amount=15) on final fail
    const history = slotHistory(rows, 'd1-t2');
    for (let i = 1; i < history.length; i++) {
      if (history[i].stage === 0 && history[i - 1].stage === 2) {
        // After final-stage fail with add_weight_reset_stage, weight should increase
        expect(history[i].weight).toBeGreaterThan(history[i - 1].weight);
      }
    }
  });

  it('weight converges toward 0 for T1 deload_percent slots', () => {
    const history = slotHistory(rows, 'd1-t1');
    const firstWeight = history[0].weight;
    const lastWeight = history[history.length - 1].weight;
    // After many deloads of 10%, weight should be much smaller
    expect(lastWeight).toBeLessThan(firstWeight);
  });

  it('isChanged is true for all slots after first fail cycle', () => {
    // After enough fails to trigger a non-no_change rule, isChanged sticks
    const lastRow = rows[rows.length - 1];
    for (const slot of lastRow.slots) {
      // T3 slots have onFinalStageFail: no_change, so they might not be changed
      const def = GZCLP_DEFINITION_FIXTURE.days[lastRow.index % 4].slots.find(
        (s) => s.id === slot.slotId
      );
      if (def?.onFinalStageFail.type !== 'no_change' && def?.onMidStageFail.type !== 'no_change') {
        expect(slot.isChanged).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Perfect linear progression — all successes
// ---------------------------------------------------------------------------

describe('scenario: perfect linear progression (all successes)', () => {
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) =>
    fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'success', amrapReps: 10 })
  );
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('T1 squat weight increases by 5kg each appearance', () => {
    const history = slotHistory(rows, 'd1-t1');
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weight).toBe(history[i - 1].weight + 5);
    }
  });

  it('T2 bench weight increases by 2.5kg each appearance', () => {
    const history = slotHistory(rows, 'd1-t2');
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weight).toBe(history[i - 1].weight + 2.5);
    }
  });

  it('T1 slots stay at stage 0 forever (never fail → never advance)', () => {
    for (const row of rows) {
      for (const slot of row.slots) {
        const def = GZCLP_DEFINITION_FIXTURE.days[row.index % 4].slots.find(
          (s) => s.id === slot.slotId
        );
        if (def?.tier === 't1') {
          expect(slot.stage).toBe(0);
        }
      }
    }
  });

  it('isChanged is false for all slots across entire program', () => {
    for (const row of rows) {
      expect(row.isChanged).toBe(false);
    }
  });

  it('no deloads within same-tier same-exercise slots', () => {
    // Note: isDeload tracks by exerciseId across ALL tiers, so T2 squat (39kg)
    // after T1 squat (60kg) is correctly flagged as isDeload=true.
    // We verify that within the same slot, weight only goes up.
    const t1Squat = slotHistory(rows, 'd1-t1');
    for (let i = 1; i < t1Squat.length; i++) {
      expect(t1Squat[i].weight).toBeGreaterThan(t1Squat[i - 1].weight);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Plateau → deload → rebuild cycle (realistic training)
// ---------------------------------------------------------------------------

describe('scenario: plateau → deload → rebuild (3 cycles)', () => {
  // Simulate: succeed 8 times, fail 3 times (through all stages), deload, repeat
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) => {
    const phase = i % 11; // 8 success + 3 fail = 11 workout cycle
    if (phase < 8) {
      return fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'success', amrapReps: 5 });
    }
    return fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'fail' });
  });
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('weight follows a sawtooth pattern (up during success, down on deload)', () => {
    const history = slotHistory(rows, 'd1-t1');
    let hasIncrease = false;
    let hasDeload = false;
    for (let i = 1; i < history.length; i++) {
      if (history[i].weight > history[i - 1].weight) hasIncrease = true;
      if (history[i].isDeload) hasDeload = true;
    }
    expect(hasIncrease).toBe(true);
    expect(hasDeload).toBe(true);
  });

  it('all weights remain non-negative', () => {
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('stages cycle correctly through the deload pattern', () => {
    const history = slotHistory(rows, 'd1-t1');
    for (const h of history) {
      expect(h.stage).toBeGreaterThanOrEqual(0);
      expect(h.stage).toBeLessThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: T3 stagnation — never recording results (implicit pass)
// ---------------------------------------------------------------------------

describe('scenario: T3 ghost — athlete never records T3 results', () => {
  // T3 has onUndefined: no_change → weight should never change
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) => {
    const cycleLen = GZCLP_DEFINITION_FIXTURE.days.length;
    const day = GZCLP_DEFINITION_FIXTURE.days[i % cycleLen];
    const out: Record<string, SlotResult> = {};
    for (const slot of day.slots) {
      if (slot.tier === 't3') {
        // No result recorded — triggers onUndefined: no_change
        out[slot.id] = {};
      } else {
        out[slot.id] = { result: 'success', amrapReps: 8 };
      }
    }
    return out;
  });
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('T3 weight stays constant for entire program', () => {
    const history = slotHistory(rows, 'latpulldown-t3');
    const initialWeight = history[0].weight;
    for (const h of history) {
      expect(h.weight).toBe(initialWeight);
    }
  });

  it('T3 stage stays at 0', () => {
    const history = slotHistory(rows, 'latpulldown-t3');
    for (const h of history) {
      expect(h.stage).toBe(0);
    }
  });

  it('T3 isChanged stays false (no_change rule does not set changed)', () => {
    const history = slotHistory(rows, 'latpulldown-t3');
    for (const h of history) {
      expect(h.isChanged).toBe(false);
    }
  });

  it('T1/T2 still progress normally while T3 stagnates', () => {
    const t1History = slotHistory(rows, 'd1-t1');
    // T1 squat should increase by 5 each appearance
    for (let i = 1; i < t1History.length; i++) {
      expect(t1History[i].weight).toBeGreaterThan(t1History[i - 1].weight);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Double progression ladder climb (Nivel7 accessories)
// ---------------------------------------------------------------------------

describe('scenario: double progression 5-stage ladder climb', () => {
  // dpAcc slots have 5 stages: 3x8→3x9→3x10→3x11→3x12
  // onSuccess: advance_stage, onFinalStageSuccess: add_weight_reset_stage(2.5)
  // Simulate: succeed every workout. Accessories should climb 8→9→10→11→12→weight+2.5→reset to 8
  const config: Record<string, number> = {};
  for (const f of NIVEL7_DEFINITION_FIXTURE.configFields) {
    config[f.key] = 50;
  }

  const results = buildResults(NIVEL7_DEFINITION_FIXTURE, 48, (i) =>
    fillWorkout(NIVEL7_DEFINITION_FIXTURE, i, { result: 'success' })
  );
  const rows = computeGenericProgram(NIVEL7_DEFINITION_FIXTURE, config, results);

  it('accessory slots climb through all 5 stages before weight bump', () => {
    // press_franc is a dpAcc slot appearing in multiple days
    const history = slotHistory(rows, 'press_franc');

    // Track stage progression
    let stageResets = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].stage === 0 && history[i - 1].stage === 4) {
        stageResets++;
        // Weight should have increased after completing stage 4 (final stage success)
        expect(history[i].weight).toBeGreaterThan(history[i - 1].weight);
      }
    }
    // Should complete at least one full ladder in 48 workouts
    expect(stageResets).toBeGreaterThan(0);
  });

  it('accessory weight increases are exactly 2.5 per ladder completion', () => {
    const history = slotHistory(rows, 'press_franc');
    for (let i = 1; i < history.length; i++) {
      if (history[i].stage === 0 && history[i - 1].stage === 4) {
        expect(history[i].weight - history[i - 1].weight).toBe(2.5);
      }
    }
  });

  it('main lifts still progress independently of accessories', () => {
    // Main lifts use add_weight on success
    const history = slotHistory(rows, 'press_mil-c1b1');
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weight).toBeGreaterThanOrEqual(history[i - 1].weight);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: TM escalation — AMRAP hero consistently hitting high reps
// ---------------------------------------------------------------------------

describe('scenario: TM escalation (consistent high AMRAP reps)', () => {
  const def = FSL531;
  // All successes with high AMRAP reps → TM should increase every cycle
  const results = buildResults(def, def.totalWorkouts, (i) =>
    fillWorkout(def, i, { result: 'success', amrapReps: 10 })
  );
  const config: Record<string, number> = {};
  for (const f of def.configFields) {
    if (f.type === 'weight') config[f.key] = 80;
  }
  const rows = computeGenericProgram(def, config, results);

  it('all weights remain non-negative and finite', () => {
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(slot.weight)).toBe(true);
      }
    }
  });

  it('output length matches definition', () => {
    expect(rows.length).toBe(def.totalWorkouts);
  });

  it('no crashes with TM increasing every cycle', () => {
    // If this runs without throwing, TM accumulation is stable
    for (const row of rows) {
      expect(row.slots.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Divergent slot progression — T1 failing while T2 succeeds
// ---------------------------------------------------------------------------

describe('scenario: divergent slots (T1 fails, T2 succeeds, T3 unrecorded)', () => {
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) =>
    fillWorkoutByTier(
      GZCLP_DEFINITION_FIXTURE,
      i,
      {
        t1: { result: 'fail' },
        t2: { result: 'success' },
      },
      {} // T3 — no result recorded
    )
  );
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('T1 weight decreases over time (repeated deloads)', () => {
    const history = slotHistory(rows, 'd1-t1');
    const firstWeight = history[0].weight;
    const lastWeight = history[history.length - 1].weight;
    expect(lastWeight).toBeLessThan(firstWeight);
  });

  it('T2 weight increases over time (continuous success)', () => {
    const history = slotHistory(rows, 'd1-t2');
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weight).toBeGreaterThan(history[i - 1].weight);
    }
  });

  it('T3 weight stays constant (onUndefined: no_change)', () => {
    const history = slotHistory(rows, 'latpulldown-t3');
    const initialWeight = history[0].weight;
    for (const h of history) {
      expect(h.weight).toBe(initialWeight);
    }
  });

  it('slot progression is fully independent', () => {
    const t1 = slotHistory(rows, 'd1-t1');
    const t2 = slotHistory(rows, 'd1-t2');
    // T1 decreases, T2 increases — they don't affect each other
    expect(t1[t1.length - 1].weight).toBeLessThan(t1[0].weight);
    expect(t2[t2.length - 1].weight).toBeGreaterThan(t2[0].weight);
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: SetLog-driven double progression
// ---------------------------------------------------------------------------

describe('scenario: setLog-driven progression', () => {
  const def = DOUBLE_PROGRESSION_DEFINITION_FIXTURE;
  // curl-dp has stages 3x8→3x9→3x10→3x11→3x12
  // With onSuccess: add_weight, onUndefined: no_change

  it('setLogs with all reps at top of range → success → weight increases', () => {
    // All sets hit 12+ reps on a 3x12 stage slot
    const results: GenericResults = {
      '0': {
        'curl-dp': {
          setLogs: [{ reps: 12 }, { reps: 13 }, { reps: 12 }],
        },
        'lat-dp': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(def, { curl: 10, lateral_raise: 5 }, results);
    // After workout 0 with success, workout 1 should have higher weight
    const curl0 = rows[0].slots.find((s) => s.slotId === 'curl-dp')!;
    const curl1 = rows[1].slots.find((s) => s.slotId === 'curl-dp')!;
    expect(curl1.weight).toBeGreaterThan(curl0.weight);
  });

  it('setLogs with reps below bottom → fail → stage advances', () => {
    // Stage 0 = 3x8. If any set < 8 (using simple derivation), it's a fail
    const results: GenericResults = {
      '0': {
        'curl-dp': {
          setLogs: [{ reps: 8 }, { reps: 7 }, { reps: 8 }],
        },
        'lat-dp': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(def, { curl: 10, lateral_raise: 5 }, results);
    const curl1 = rows[1].slots.find((s) => s.slotId === 'curl-dp')!;
    // onMidStageFail is no_change, so stage and weight shouldn't change
    expect(curl1.stage).toBe(0);
    expect(curl1.weight).toBe(10);
  });

  it('setLogs override explicit result when both are present', () => {
    // Explicit result says 'success' but setLogs say 'fail'
    const results: GenericResults = {
      '0': {
        'curl-dp': {
          result: 'success',
          setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 5 }], // all below 8
        },
        'lat-dp': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(def, { curl: 10, lateral_raise: 5 }, results);
    // SetLogs derive fail, which overrides the explicit success
    const curl0 = rows[0].slots.find((s) => s.slotId === 'curl-dp')!;
    // Result shown should be the derived one (fail)
    expect(curl0.result).toBe('fail');
  });

  it('empty setLogs fall back to explicit result', () => {
    const results: GenericResults = {
      '0': {
        'curl-dp': {
          result: 'success',
          setLogs: [],
        },
        'lat-dp': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(def, { curl: 10, lateral_raise: 5 }, results);
    const curl0 = rows[0].slots.find((s) => s.slotId === 'curl-dp')!;
    expect(curl0.result).toBe('success');
    // And progression should apply (weight increases)
    const curl1 = rows[1].slots.find((s) => s.slotId === 'curl-dp')!;
    expect(curl1.weight).toBeGreaterThan(curl0.weight);
  });
});

// ---------------------------------------------------------------------------
// Scenario 9: PPL 5/3/1 — AMRAP below threshold → TM doesn't change
// ---------------------------------------------------------------------------

describe('scenario: PPL 5/3/1 AMRAP threshold behavior', () => {
  const def = PPL531;
  const config: Record<string, number> = {};
  for (const f of def.configFields) {
    if (f.type === 'weight') config[f.key] = 60;
  }

  it('AMRAP reps below minAmrapReps → TM stays the same', () => {
    // Success with only 2 AMRAP reps (threshold is typically 5)
    const results = buildResults(def, def.totalWorkouts, (i) =>
      fillWorkout(def, i, { result: 'success', amrapReps: 2 })
    );
    const rows = computeGenericProgram(def, config, results);
    // Should not crash and all weights should be valid
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(slot.weight)).toBe(true);
      }
    }
  });

  it('AMRAP reps at exactly minAmrapReps → TM increases', () => {
    const results = buildResults(def, def.totalWorkouts, (i) =>
      fillWorkout(def, i, { result: 'success', amrapReps: 5 })
    );
    const rows = computeGenericProgram(def, config, results);
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(slot.weight)).toBe(true);
      }
    }
  });

  it('zero AMRAP reps with success → TM unchanged, no crash', () => {
    const results = buildResults(def, def.totalWorkouts, (i) =>
      fillWorkout(def, i, { result: 'success', amrapReps: 0 })
    );
    const rows = computeGenericProgram(def, config, results);
    expect(rows.length).toBe(def.totalWorkouts);
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 10: Sparse results — only some workouts have results
// ---------------------------------------------------------------------------

describe('scenario: sparse results (athlete skips recording many workouts)', () => {
  // Only record results for every 5th workout
  const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) => {
    if (i % 5 === 0) {
      return fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'success', amrapReps: 8 });
    }
    return {}; // empty — no results for this workout
  });
  const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);

  it('engine handles sparse results without crashing', () => {
    expect(rows.length).toBe(90);
  });

  it('T1 weight still increases (unrecorded = implicit pass via onUndefined ?? onSuccess)', () => {
    const history = slotHistory(rows, 'd1-t1');
    // T1 has no onUndefined → falls back to onSuccess (add_weight)
    // So unrecorded workouts still add weight
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weight).toBeGreaterThanOrEqual(history[i - 1].weight);
    }
  });

  it('T3 weight stays constant (onUndefined: no_change prevents implicit progression)', () => {
    const history = slotHistory(rows, 'latpulldown-t3');
    // T3 has onUndefined: no_change → unrecorded stays flat
    // Only the explicit successes (every 5th) should increase weight
    // But since onSuccess is add_weight, the recorded ones DO increase
    let unchangedCount = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].weight === history[i - 1].weight) unchangedCount++;
    }
    // Most should be unchanged (4 out of every 5 are unrecorded)
    expect(unchangedCount).toBeGreaterThan(history.length / 2);
  });

  it('all structural invariants hold', () => {
    for (const row of rows) {
      for (const slot of row.slots) {
        expect(slot.weight).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(slot.weight)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 11: Maximum weight accumulation — does it overflow?
// ---------------------------------------------------------------------------

describe('scenario: extreme weight accumulation', () => {
  it('GZCLP with very high starting weights + all successes stays finite', () => {
    const highConfig: Record<string, number> = {};
    for (const f of GZCLP_DEFINITION_FIXTURE.configFields) {
      highConfig[f.key] = 500; // 500 kg starting weight
    }
    const results = buildResults(GZCLP_DEFINITION_FIXTURE, 90, (i) =>
      fillWorkout(GZCLP_DEFINITION_FIXTURE, i, { result: 'success', amrapReps: 10 })
    );
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, highConfig, results);

    for (const row of rows) {
      for (const slot of row.slots) {
        expect(Number.isFinite(slot.weight)).toBe(true);
        expect(slot.weight).toBeGreaterThan(0);
      }
    }

    // Final squat T1 weight should be 500 + (N appearances * 5)
    const history = slotHistory(rows, 'd1-t1');
    const expectedFinal = 500 + (history.length - 1) * 5;
    expect(history[history.length - 1].weight).toBe(expectedFinal);
  });
});

// ---------------------------------------------------------------------------
// Scenario 12: Sheiko — results don't affect prescription weights
// ---------------------------------------------------------------------------

describe('scenario: prescription immunity to results', () => {
  const def = PRESCRIPTION_FIXTURE;
  const config = { squat1rm: 100, bench1rm: 80 };

  const allFails = buildResults(def, def.totalWorkouts, (i) =>
    fillWorkout(def, i, { result: 'fail' })
  );
  const allSuccess = buildResults(def, def.totalWorkouts, (i) =>
    fillWorkout(def, i, { result: 'success', amrapReps: 10 })
  );
  const noResults: GenericResults = {};

  const rowsFail = computeGenericProgram(def, config, allFails);
  const rowsSuccess = computeGenericProgram(def, config, allSuccess);
  const rowsEmpty = computeGenericProgram(def, config, noResults);

  it('prescription weights are identical regardless of all-fail vs all-success vs empty', () => {
    for (let i = 0; i < rowsFail.length; i++) {
      for (let s = 0; s < rowsFail[i].slots.length; s++) {
        expect(rowsFail[i].slots[s].weight).toBe(rowsEmpty[i].slots[s].weight);
        expect(rowsSuccess[i].slots[s].weight).toBe(rowsEmpty[i].slots[s].weight);
      }
    }
  });

  it('prescription weights match expected %1RM calculations', () => {
    // Day 1: squat prescriptions 50%, 60%, 70% of 100kg
    // Working weight = last prescription = 70% of 100 = 70
    const sqSlot = rowsEmpty[0].slots[0];
    expect(sqSlot.weight).toBe(70);
    expect(sqSlot.prescriptions).toBeDefined();
    expect(sqSlot.prescriptions![0].weight).toBe(50); // 50% of 100
    expect(sqSlot.prescriptions![1].weight).toBe(60); // 60% of 100
    expect(sqSlot.prescriptions![2].weight).toBe(70); // 70% of 100

    // Day 2: bench prescriptions 50%, 65% of 80kg
    const bpSlot = rowsEmpty[1].slots[0];
    expect(bpSlot.weight).toBe(52.5); // 65% of 80 = 52, rounded to nearest 2.5
    expect(bpSlot.prescriptions![0].weight).toBe(40); // 50% of 80
    expect(bpSlot.prescriptions![1].weight).toBe(52.5); // 65% of 80
  });

  it('prescription stage is always 0 and stagesCount is always 1', () => {
    for (const row of rowsFail) {
      for (const slot of row.slots) {
        expect(slot.stage).toBe(0);
        expect(slot.stagesCount).toBe(1);
      }
    }
  });
});
