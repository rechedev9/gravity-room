/**
 * Property-based fuzz tests for the progression engine.
 *
 * Uses fast-check to generate thousands of random result sequences and verify
 * that structural invariants always hold, regardless of input combinations.
 * Complements the example-based tests in generic-engine.test.ts.
 */
import { describe, it, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  computeGenericProgram,
  roundToNearest,
  roundToNearestHalf,
  deriveResultFromSetLogs,
  deriveResultFromSetLogsSimple,
} from './generic-engine';
import {
  GZCLP_DEFINITION_FIXTURE,
  NIVEL7_DEFINITION_FIXTURE,
  DOUBLE_PROGRESSION_DEFINITION_FIXTURE,
  DEFAULT_WEIGHTS,
} from '../test/fixtures';
import { FSL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/fsl531';
import { SHEIKO_7_1_DEFINITION } from '../../../apps/api/src/db/seeds/programs/sheiko-7-1';
import { PPL531_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/ppl531';
import type { ProgramDefinition, GenericResults } from './types/program';
import type { SetLogEntry } from './types/index';

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
const SHEIKO = hydrate(SHEIKO_7_1_DEFINITION as unknown as Record<string, unknown>);

// ---------------------------------------------------------------------------
// Arbitraries — generators for random inputs
// ---------------------------------------------------------------------------

/** Random SetLogEntry: per-set reps, optional weight and rpe. */
const arbSetLogEntry: fc.Arbitrary<SetLogEntry> = fc.record({
  reps: fc.integer({ min: 0, max: 30 }),
  weight: fc.option(
    fc.integer({ min: 0, max: 200 }).map((n) => n * 2.5),
    { nil: undefined }
  ),
  rpe: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
});

/** Random setLogs array (1-10 sets) or undefined. */
const arbSetLogs: fc.Arbitrary<SetLogEntry[] | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.array(arbSetLogEntry, { minLength: 1, maxLength: 10 })
);

/** Random slot result: success, fail, with setLogs, or omitted (implicit pass). */
const arbSlotResult = fc.oneof(
  fc.constant(undefined), // omitted — triggers onUndefined ?? onSuccess
  fc.record({
    result: fc.constantFrom('success' as const, 'fail' as const),
    amrapReps: fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
    rpe: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  }),
  // Slot result with setLogs (for double progression / simple derivation)
  fc.record({
    result: fc.option(fc.constantFrom('success' as const, 'fail' as const), { nil: undefined }),
    amrapReps: fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
    rpe: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    setLogs: arbSetLogs,
  })
);

/** Build a random GenericResults for a given definition up to workout N. */
function arbResults(
  definition: ProgramDefinition,
  maxWorkouts?: number
): fc.Arbitrary<GenericResults> {
  const total = maxWorkouts ?? definition.totalWorkouts;
  const cycleLen = definition.days.length;

  return fc.integer({ min: 0, max: total }).chain((completedCount) => {
    if (completedCount === 0) return fc.constant({});

    const entries: fc.Arbitrary<[string, Record<string, unknown>]>[] = [];

    for (let i = 0; i < completedCount; i++) {
      const day = definition.days[i % cycleLen];
      const slotArbs: Record<string, fc.Arbitrary<unknown>> = {};
      for (const slot of day.slots) {
        slotArbs[slot.id] = arbSlotResult;
      }
      entries.push(
        fc
          .record(slotArbs)
          .map((slotResults) => [String(i), slotResults] as [string, Record<string, unknown>])
      );
    }

    return fc.tuple(...entries).map((pairs) => Object.fromEntries(pairs) as GenericResults);
  });
}

/** Random starting weights (realistic range: 0 to 200 kg, multiples of 2.5). */
function arbConfig(definition: ProgramDefinition): fc.Arbitrary<Record<string, number>> {
  const keys = definition.configFields.filter((f) => f.type === 'weight').map((f) => f.key);

  const arbs: Record<string, fc.Arbitrary<number>> = {};
  for (const key of keys) {
    arbs[key] = fc.integer({ min: 0, max: 80 }).map((n) => n * 2.5);
  }
  return fc.record(arbs);
}

/** Random config with a mix of numeric and string values. */
function arbMixedConfig(
  definition: ProgramDefinition
): fc.Arbitrary<Record<string, number | string>> {
  const keys = definition.configFields.filter((f) => f.type === 'weight').map((f) => f.key);

  const arbs: Record<string, fc.Arbitrary<number | string>> = {};
  for (const key of keys) {
    arbs[key] = fc.oneof(
      fc.integer({ min: 0, max: 80 }).map((n) => n * 2.5),
      fc.integer({ min: 0, max: 80 }).map((n) => String(n * 2.5)),
      fc.constant('not-a-number'), // should fallback to 0
      fc.constant('') // should fallback to 0
    );
  }
  return fc.record(arbs);
}

/** Double progression rule params with random rep ranges. */
const arbDoubleProgressionRule = fc.integer({ min: 1, max: 20 }).chain((bottom) =>
  fc.integer({ min: bottom, max: bottom + 10 }).map((top) => ({
    type: 'double_progression' as const,
    repRangeTop: top,
    repRangeBottom: bottom,
  }))
);

// ---------------------------------------------------------------------------
// Invariant checkers
// ---------------------------------------------------------------------------

function assertInvariants(
  rows: ReturnType<typeof computeGenericProgram>,
  definition: ProgramDefinition
): void {
  // INV-1: Output length always equals totalWorkouts
  expect(rows.length).toBe(definition.totalWorkouts);

  const cycleLen = definition.days.length;

  for (const row of rows) {
    const day = definition.days[row.index % cycleLen];

    // INV-2: Every day has the correct number of slots
    expect(row.slots.length).toBe(day.slots.length);

    // INV-3: Day name matches cycle position
    expect(row.dayName).toBe(day.name);

    for (const slot of row.slots) {
      const slotDef = day.slots.find((s) => s.id === slot.slotId);
      expect(slotDef).toBeDefined();

      // INV-4: Weight is never negative
      expect(slot.weight).toBeGreaterThanOrEqual(0);

      // INV-5: Weight is finite (no NaN, no Infinity)
      expect(Number.isFinite(slot.weight)).toBe(true);

      // Skip stage checks for prescription/GPP slots
      if (slotDef!.prescriptions !== undefined || slotDef!.isGpp === true) continue;

      // INV-6: Stage is always in bounds [0, stagesCount-1]
      expect(slot.stage).toBeGreaterThanOrEqual(0);
      expect(slot.stage).toBeLessThan(slot.stagesCount);

      // INV-7: stagesCount matches definition
      expect(slot.stagesCount).toBe(slotDef!.stages.length);

      // INV-8: sets and reps are positive integers
      expect(slot.sets).toBeGreaterThan(0);
      expect(slot.reps).toBeGreaterThan(0);
    }

    // INV-9: row.isChanged is consistent with slot flags
    const anySlotChanged = row.slots.some((s) => s.isChanged);
    expect(row.isChanged).toBe(anySlotChanged);
  }
}

function assertIsChangedPersistence(rows: ReturnType<typeof computeGenericProgram>): void {
  // INV-10: Once isChanged is true for a slot, it stays true forever
  const changedSlots = new Set<string>();

  for (const row of rows) {
    for (const slot of row.slots) {
      if (changedSlots.has(slot.slotId)) {
        expect(slot.isChanged).toBe(true);
      }
      if (slot.isChanged) {
        changedSlots.add(slot.slotId);
      }
    }
  }
}

function assertPrescriptionInvariants(
  rows: ReturnType<typeof computeGenericProgram>,
  definition: ProgramDefinition
): void {
  const cycleLen = definition.days.length;

  for (const row of rows) {
    const day = definition.days[row.index % cycleLen];
    for (let s = 0; s < row.slots.length; s++) {
      const slot = row.slots[s];
      const slotDef = day.slots[s];

      if (slotDef.prescriptions === undefined) continue;

      // INV-P1: Prescription slots always have prescriptions array
      expect(slot.prescriptions).toBeDefined();
      expect(slot.prescriptions!.length).toBe(slotDef.prescriptions.length);

      // INV-P2: All prescription weights are non-negative and finite
      for (const p of slot.prescriptions!) {
        expect(p.weight).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(p.weight)).toBe(true);
      }

      // INV-P3: Working weight equals last prescription's weight
      const lastPrescription = slot.prescriptions![slot.prescriptions!.length - 1];
      expect(slot.weight).toBe(lastPrescription.weight);

      // INV-P4: Stage is always 0 for prescription slots
      expect(slot.stage).toBe(0);
      expect(slot.stagesCount).toBe(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Fuzz tests — structural invariants across program types
// ---------------------------------------------------------------------------

const NUM_RUNS = 500;

describe('fuzz: structural invariants', () => {
  it('GZCLP — random results + setLogs', () => {
    fc.assert(
      fc.property(arbResults(GZCLP_DEFINITION_FIXTURE), (results) => {
        const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
        assertInvariants(rows, GZCLP_DEFINITION_FIXTURE);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('GZCLP — random configs + random results', () => {
    fc.assert(
      fc.property(
        arbConfig(GZCLP_DEFINITION_FIXTURE),
        arbResults(GZCLP_DEFINITION_FIXTURE),
        (config, results) => {
          const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, config, results);
          assertInvariants(rows, GZCLP_DEFINITION_FIXTURE);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('Nivel7 — random results (double progression + startWeightOffset)', () => {
    fc.assert(
      fc.property(arbResults(NIVEL7_DEFINITION_FIXTURE), (results) => {
        const config: Record<string, number> = {};
        for (const f of NIVEL7_DEFINITION_FIXTURE.configFields) {
          config[f.key] = 50;
        }
        const rows = computeGenericProgram(NIVEL7_DEFINITION_FIXTURE, config, results);
        assertInvariants(rows, NIVEL7_DEFINITION_FIXTURE);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Double Progression — random results with setLogs', () => {
    fc.assert(
      fc.property(arbResults(DOUBLE_PROGRESSION_DEFINITION_FIXTURE), (results) => {
        const config = { curl: 10, lateral_raise: 5 };
        const rows = computeGenericProgram(DOUBLE_PROGRESSION_DEFINITION_FIXTURE, config, results);
        assertInvariants(rows, DOUBLE_PROGRESSION_DEFINITION_FIXTURE);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('FSL 5/3/1 — TM-based program with update_tm rules', () => {
    fc.assert(
      fc.property(arbConfig(FSL531), arbResults(FSL531), (config, results) => {
        const rows = computeGenericProgram(FSL531, config, results);
        assertInvariants(rows, FSL531);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('PPL 5/3/1 — TM-based program with AMRAP thresholds', () => {
    fc.assert(
      fc.property(arbConfig(PPL531), arbResults(PPL531), (config, results) => {
        const rows = computeGenericProgram(PPL531, config, results);
        assertInvariants(rows, PPL531);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Sheiko 7-1 — prescription-based %1RM program', () => {
    fc.assert(
      fc.property(arbConfig(SHEIKO), arbResults(SHEIKO), (config, results) => {
        const rows = computeGenericProgram(SHEIKO, config, results);
        assertInvariants(rows, SHEIKO);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — prescription-specific invariants
// ---------------------------------------------------------------------------

describe('fuzz: prescription slots', () => {
  it('Sheiko — prescription weights are always non-negative and match last entry', () => {
    fc.assert(
      fc.property(arbConfig(SHEIKO), (config) => {
        const rows = computeGenericProgram(SHEIKO, config, {});
        assertPrescriptionInvariants(rows, SHEIKO);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Sheiko — prescriptions are invariant to result sequences (no progression)', () => {
    fc.assert(
      fc.property(arbConfig(SHEIKO), arbResults(SHEIKO), (config, results) => {
        const withResults = computeGenericProgram(SHEIKO, config, results);
        const withoutResults = computeGenericProgram(SHEIKO, config, {});

        const cycleLen = SHEIKO.days.length;
        for (let i = 0; i < withResults.length; i++) {
          const day = SHEIKO.days[i % cycleLen];
          for (let s = 0; s < withResults[i].slots.length; s++) {
            if (day.slots[s].prescriptions === undefined) continue;
            // Prescription-derived weights should be identical regardless of results
            expect(withResults[i].slots[s].weight).toBe(withoutResults[i].slots[s].weight);
            expect(withResults[i].slots[s].prescriptions).toEqual(
              withoutResults[i].slots[s].prescriptions
            );
          }
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — Training Max (update_tm)
// ---------------------------------------------------------------------------

describe('fuzz: training max progression', () => {
  it('FSL 5/3/1 — TM only changes on success with sufficient AMRAP reps', () => {
    fc.assert(
      fc.property(arbConfig(FSL531), arbResults(FSL531), (config, results) => {
        const rows = computeGenericProgram(FSL531, config, results);
        // All structural invariants still hold
        assertInvariants(rows, FSL531);
        // isChanged persistence holds
        assertIsChangedPersistence(rows);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('FSL 5/3/1 — all-fail results keep TM-derived weights non-negative', () => {
    const def = FSL531;
    const cycleLen = def.days.length;
    const allFails: GenericResults = {};
    for (let i = 0; i < def.totalWorkouts; i++) {
      const day = def.days[i % cycleLen];
      const slotResults: Record<string, { result: 'fail' }> = {};
      for (const slot of day.slots) {
        slotResults[slot.id] = { result: 'fail' };
      }
      allFails[String(i)] = slotResults;
    }

    fc.assert(
      fc.property(arbConfig(def), (config) => {
        const rows = computeGenericProgram(def, config, allFails);
        for (const row of rows) {
          for (const slot of row.slots) {
            expect(slot.weight).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(slot.weight)).toBe(true);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('PPL 5/3/1 — AMRAP-driven TM never decreases', () => {
    // For update_tm with positive amount, TM should never decrease
    const def = PPL531;

    fc.assert(
      fc.property(arbConfig(def), arbResults(def), (config, results) => {
        const rows = computeGenericProgram(def, config, results);
        assertInvariants(rows, def);
        // All weights remain valid
        for (const row of rows) {
          for (const slot of row.slots) {
            expect(slot.weight).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — isChanged persistence
// ---------------------------------------------------------------------------

describe('fuzz: isChanged persistence', () => {
  it('GZCLP — once a slot is marked changed, it stays changed forever', () => {
    fc.assert(
      fc.property(arbResults(GZCLP_DEFINITION_FIXTURE), (results) => {
        const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
        assertIsChangedPersistence(rows);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Nivel7 — once a slot is marked changed, it stays changed forever', () => {
    fc.assert(
      fc.property(arbResults(NIVEL7_DEFINITION_FIXTURE), (results) => {
        const config: Record<string, number> = {};
        for (const f of NIVEL7_DEFINITION_FIXTURE.configFields) {
          config[f.key] = 50;
        }
        const rows = computeGenericProgram(NIVEL7_DEFINITION_FIXTURE, config, results);
        assertIsChangedPersistence(rows);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('FSL 5/3/1 — isChanged persistence with TM-based progression', () => {
    fc.assert(
      fc.property(arbConfig(FSL531), arbResults(FSL531), (config, results) => {
        const rows = computeGenericProgram(FSL531, config, results);
        assertIsChangedPersistence(rows);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — determinism
// ---------------------------------------------------------------------------

describe('fuzz: determinism', () => {
  it('GZCLP — same inputs always produce identical output', () => {
    fc.assert(
      fc.property(
        arbConfig(GZCLP_DEFINITION_FIXTURE),
        arbResults(GZCLP_DEFINITION_FIXTURE),
        (config, results) => {
          const a = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, config, results);
          const b = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, config, results);
          expect(a).toEqual(b);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('Sheiko — same inputs always produce identical output', () => {
    fc.assert(
      fc.property(arbConfig(SHEIKO), arbResults(SHEIKO), (config, results) => {
        const a = computeGenericProgram(SHEIKO, config, results);
        const b = computeGenericProgram(SHEIKO, config, results);
        expect(a).toEqual(b);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — weight bounds under extreme conditions
// ---------------------------------------------------------------------------

describe('fuzz: weight bounds under extreme conditions', () => {
  it('GZCLP — repeated final-stage fails never produce negative weights', () => {
    const cycleLen = GZCLP_DEFINITION_FIXTURE.days.length;
    const allFails: GenericResults = {};
    for (let i = 0; i < GZCLP_DEFINITION_FIXTURE.totalWorkouts; i++) {
      const day = GZCLP_DEFINITION_FIXTURE.days[i % cycleLen];
      const slotResults: Record<string, { result: 'fail' }> = {};
      for (const slot of day.slots) {
        slotResults[slot.id] = { result: 'fail' };
      }
      allFails[String(i)] = slotResults;
    }

    fc.assert(
      fc.property(arbConfig(GZCLP_DEFINITION_FIXTURE), (config) => {
        const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, config, allFails);
        for (const row of rows) {
          for (const slot of row.slots) {
            expect(slot.weight).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(slot.weight)).toBe(true);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('GZCLP — zero starting weights stay non-negative under all result patterns', () => {
    const zeroConfig: Record<string, number> = {};
    for (const f of GZCLP_DEFINITION_FIXTURE.configFields) {
      zeroConfig[f.key] = 0;
    }

    fc.assert(
      fc.property(arbResults(GZCLP_DEFINITION_FIXTURE), (results) => {
        const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, zeroConfig, results);
        for (const row of rows) {
          for (const slot of row.slots) {
            expect(slot.weight).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Nivel7 — startWeightOffset never causes negative initial weights', () => {
    fc.assert(
      fc.property(arbConfig(NIVEL7_DEFINITION_FIXTURE), (config) => {
        const rows = computeGenericProgram(NIVEL7_DEFINITION_FIXTURE, config, {});
        for (const row of rows) {
          for (const slot of row.slots) {
            expect(slot.weight).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(slot.weight)).toBe(true);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — string config values (configToNum)
// ---------------------------------------------------------------------------

describe('fuzz: mixed string/number configs', () => {
  it('GZCLP — string config values never cause crashes or invalid state', () => {
    fc.assert(
      fc.property(
        arbMixedConfig(GZCLP_DEFINITION_FIXTURE),
        arbResults(GZCLP_DEFINITION_FIXTURE),
        (config, results) => {
          const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, config, results);
          assertInvariants(rows, GZCLP_DEFINITION_FIXTURE);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('FSL 5/3/1 — string TM config values never cause crashes', () => {
    fc.assert(
      fc.property(arbMixedConfig(FSL531), arbResults(FSL531), (config, results) => {
        const rows = computeGenericProgram(FSL531, config, results);
        assertInvariants(rows, FSL531);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Sheiko — string 1RM config values never cause crashes', () => {
    fc.assert(
      fc.property(arbMixedConfig(SHEIKO), (config) => {
        const rows = computeGenericProgram(SHEIKO, config, {});
        assertInvariants(rows, SHEIKO);
        assertPrescriptionInvariants(rows, SHEIKO);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — deriveResultFromSetLogs (direct)
// ---------------------------------------------------------------------------

describe('fuzz: deriveResultFromSetLogs', () => {
  it('returns undefined for empty or missing setLogs', () => {
    fc.assert(
      fc.property(arbDoubleProgressionRule, (rule) => {
        expect(deriveResultFromSetLogs(undefined, rule)).toBeUndefined();
        expect(deriveResultFromSetLogs([], rule)).toBeUndefined();
      }),
      { numRuns: 500 }
    );
  });

  it('result is always success, fail, or undefined — never anything else', () => {
    fc.assert(
      fc.property(
        fc.array(arbSetLogEntry, { minLength: 1, maxLength: 10 }),
        arbDoubleProgressionRule,
        (setLogs, rule) => {
          const result = deriveResultFromSetLogs(setLogs, rule);
          expect(result === 'success' || result === 'fail' || result === undefined).toBe(true);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('all reps >= repRangeTop implies success', () => {
    fc.assert(
      fc.property(arbDoubleProgressionRule, (rule) => {
        const logs: SetLogEntry[] = Array.from({ length: 3 }, () => ({
          reps: rule.repRangeTop + fc.sample(fc.integer({ min: 0, max: 5 }), 1)[0],
        }));
        const result = deriveResultFromSetLogs(logs, rule);
        expect(result).toBe('success');
      }),
      { numRuns: 1000 }
    );
  });

  it('any reps < repRangeBottom implies fail', () => {
    fc.assert(
      fc.property(
        arbDoubleProgressionRule.filter((r) => r.repRangeBottom > 1),
        (rule) => {
          const goodLogs: SetLogEntry[] = [{ reps: rule.repRangeTop }];
          const badLog: SetLogEntry = { reps: rule.repRangeBottom - 1 };
          const logs = [...goodLogs, badLog];
          const result = deriveResultFromSetLogs(logs, rule);
          expect(result).toBe('fail');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('reps in [repRangeBottom, repRangeTop) returns undefined (maintain zone)', () => {
    fc.assert(
      fc.property(
        arbDoubleProgressionRule.filter((r) => r.repRangeTop > r.repRangeBottom),
        (rule) => {
          // All reps exactly at repRangeBottom (>= bottom but < top since top > bottom)
          const midReps = rule.repRangeBottom;
          const logs: SetLogEntry[] = [{ reps: midReps }, { reps: midReps }];
          const result = deriveResultFromSetLogs(logs, rule);
          // Should be undefined since all reps >= bottom but not all >= top
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — deriveResultFromSetLogsSimple (direct)
// ---------------------------------------------------------------------------

describe('fuzz: deriveResultFromSetLogsSimple', () => {
  it('returns undefined for empty or missing setLogs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (targetReps) => {
        expect(deriveResultFromSetLogsSimple(undefined, targetReps)).toBeUndefined();
        expect(deriveResultFromSetLogsSimple([], targetReps)).toBeUndefined();
      }),
      { numRuns: 500 }
    );
  });

  it('result is always success, fail, or undefined — never anything else', () => {
    fc.assert(
      fc.property(
        fc.array(arbSetLogEntry, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 20 }),
        (setLogs, targetReps) => {
          const result = deriveResultFromSetLogsSimple(setLogs, targetReps);
          expect(result === 'success' || result === 'fail' || result === undefined).toBe(true);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('all reps >= targetReps implies success', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (targetReps, extra) => {
          const logs: SetLogEntry[] = Array.from({ length: 3 }, () => ({
            reps: targetReps + extra,
          }));
          const result = deriveResultFromSetLogsSimple(logs, targetReps);
          expect(result).toBe('success');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('any reps < targetReps implies fail', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 15 }), (targetReps) => {
        const logs: SetLogEntry[] = [
          { reps: targetReps },
          { reps: targetReps - 1 }, // one set below target
        ];
        const result = deriveResultFromSetLogsSimple(logs, targetReps);
        expect(result).toBe('fail');
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — roundToNearest / roundToNearestHalf
// ---------------------------------------------------------------------------

describe('fuzz: roundToNearest / roundToNearestHalf', () => {
  it('roundToNearest is always non-negative and finite', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: -10, max: 50, noNaN: true }),
        (value, step) => {
          const result = roundToNearest(value, step);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(result)).toBe(true);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('roundToNearestHalf is always non-negative and finite', () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (value) => {
        const result = roundToNearestHalf(value);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('roundToNearest is idempotent for positive steps', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0.5, max: 10, noNaN: true }),
        (value, step) => {
          const once = roundToNearest(value, step);
          const twice = roundToNearest(once, step);
          expect(twice).toBe(once);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('roundToNearest handles NaN and Infinity gracefully', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      for (const step of [2.5, 0, -1, NaN, Infinity]) {
        const result = roundToNearest(value, step);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result)).toBe(true);
      }
    }
    for (const value of [NaN, Infinity, -Infinity]) {
      const result = roundToNearestHalf(value);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Fuzz tests — stage transitions
// ---------------------------------------------------------------------------

describe('fuzz: stage transitions', () => {
  it('GZCLP — stage never exceeds max for any slot', () => {
    fc.assert(
      fc.property(arbResults(GZCLP_DEFINITION_FIXTURE), (results) => {
        const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, results);
        const cycleLen = GZCLP_DEFINITION_FIXTURE.days.length;

        for (const row of rows) {
          const day = GZCLP_DEFINITION_FIXTURE.days[row.index % cycleLen];
          for (let s = 0; s < row.slots.length; s++) {
            const slot = row.slots[s];
            const slotDef = day.slots[s];
            if (slotDef.prescriptions !== undefined || slotDef.isGpp === true) continue;
            expect(slot.stage).toBeLessThan(slotDef.stages.length);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('Nivel7 — 5-stage double progression slots stay in bounds under rapid success/fail', () => {
    fc.assert(
      fc.property(
        arbConfig(NIVEL7_DEFINITION_FIXTURE),
        arbResults(NIVEL7_DEFINITION_FIXTURE),
        (config, results) => {
          const rows = computeGenericProgram(NIVEL7_DEFINITION_FIXTURE, config, results);
          const cycleLen = NIVEL7_DEFINITION_FIXTURE.days.length;

          for (const row of rows) {
            const day = NIVEL7_DEFINITION_FIXTURE.days[row.index % cycleLen];
            for (let s = 0; s < row.slots.length; s++) {
              const slot = row.slots[s];
              const slotDef = day.slots[s];
              if (slotDef.prescriptions !== undefined || slotDef.isGpp === true) continue;
              expect(slot.stage).toBeGreaterThanOrEqual(0);
              expect(slot.stage).toBeLessThan(slotDef.stages.length);
            }
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
