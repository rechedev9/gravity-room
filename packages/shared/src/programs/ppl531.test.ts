import { describe, it, expect } from 'bun:test';
import { PPL531_DEFINITION } from './ppl531';
import { ProgramDefinitionSchema } from '../schemas/program-definition';
import { computeGenericProgram, roundToNearestHalf } from '../generic-engine';
import { getProgramDefinition, getAllPresetPrograms } from './registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All slots flattened across all days. */
function allSlots(): Array<
  PPL531Definition['days'][number]['slots'][number] & { dayName: string }
> {
  return PPL531_DEFINITION.days.flatMap((day) =>
    day.slots.map((slot) => ({ ...slot, dayName: day.name }))
  );
}

type PPL531Definition = typeof PPL531_DEFINITION;

const TM_KEYS = ['squat_tm', 'bench_tm', 'deadlift_tm', 'ohp_tm', 'pullup_tm'] as const;

/** Base config with all TMs and zero-weight accessories. */
function makeConfig(overrides?: Record<string, number>): Record<string, number> {
  const base: Record<string, number> = {
    squat_tm: 100,
    bench_tm: 80,
    deadlift_tm: 120,
    ohp_tm: 60,
    pullup_tm: 50,
    // Accessories at 0
    lat_pulldown: 0,
    seated_row: 0,
    face_pull: 0,
    hammer_curl_a: 0,
    incline_curl: 0,
    bent_over_row: 0,
    incline_row: 0,
    hammer_curl_b: 0,
    lying_bicep_curl: 0,
    incline_db_press: 0,
    triceps_pushdown: 0,
    triceps_extension: 0,
    lateral_raise: 0,
    barbell_rdl: 0,
    dumbbell_rdl: 0,
    bulgarian_split_squat: 0,
    cable_pull_through: 0,
    standing_calf_raise: 0,
    seated_leg_curl: 0,
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 4.8 — Definition Structure Tests
// ---------------------------------------------------------------------------

describe('PPL531_DEFINITION', () => {
  describe('schema validation (REQ-PPL-001)', () => {
    it('should parse against ProgramDefinitionSchema without errors', () => {
      const result = ProgramDefinitionSchema.safeParse(PPL531_DEFINITION);
      expect(result.success).toBe(true);
    });

    it('should have correct metadata', () => {
      expect(PPL531_DEFINITION.id).toBe('ppl531');
      expect(PPL531_DEFINITION.totalWorkouts).toBe(156);
      expect(PPL531_DEFINITION.cycleLength).toBe(6);
      expect(PPL531_DEFINITION.workoutsPerWeek).toBe(6);
      expect(PPL531_DEFINITION.source).toBe('preset');
    });

    it('should have 6 days in the correct order', () => {
      expect(PPL531_DEFINITION.days).toHaveLength(6);

      const dayNames = PPL531_DEFINITION.days.map((d) => d.name);
      expect(dayNames).toEqual(['Pull A', 'Push A', 'Legs A', 'Pull B', 'Push B', 'Legs B']);
    });
  });

  describe('main lift configuration (REQ-PPL-002)', () => {
    it('should have squat AMRAP slot with role primary and update_tm +5', () => {
      const squatAmrap = allSlots().find(
        (s) => s.trainingMaxKey === 'squat_tm' && s.tmPercent === 0.85
      );

      expect(squatAmrap).toBeDefined();
      expect(squatAmrap?.role).toBe('primary');
      expect(squatAmrap?.onSuccess).toEqual({
        type: 'update_tm',
        amount: 5,
        minAmrapReps: 5,
      });
      expect(squatAmrap?.stages[0].amrap).toBe(true);
    });

    it('should have bench AMRAP slot with update_tm amount 2.5', () => {
      const benchAmrap = allSlots().find(
        (s) => s.trainingMaxKey === 'bench_tm' && s.tmPercent === 0.85
      );

      expect(benchAmrap).toBeDefined();
      expect(benchAmrap?.onSuccess).toEqual({
        type: 'update_tm',
        amount: 2.5,
        minAmrapReps: 5,
      });
    });

    it('should have squat 75% work set with role secondary', () => {
      const squatWork = allSlots().find(
        (s) => s.trainingMaxKey === 'squat_tm' && s.tmPercent === 0.75
      );

      expect(squatWork).toBeDefined();
      expect(squatWork?.role).toBe('secondary');
    });

    it('should have deadlift AMRAP with update_tm amount 5', () => {
      const dlAmrap = allSlots().find(
        (s) => s.trainingMaxKey === 'deadlift_tm' && s.tmPercent === 0.85
      );

      expect(dlAmrap).toBeDefined();
      expect(dlAmrap?.onSuccess).toEqual({
        type: 'update_tm',
        amount: 5,
        minAmrapReps: 5,
      });
    });

    it('should have pullup AMRAP with update_tm amount 2.5', () => {
      const pullupAmrap = allSlots().find(
        (s) => s.trainingMaxKey === 'pullup_tm' && s.tmPercent === 0.85
      );

      expect(pullupAmrap).toBeDefined();
      expect(pullupAmrap?.onSuccess).toEqual({
        type: 'update_tm',
        amount: 2.5,
        minAmrapReps: 5,
      });
    });

    it('should have OHP AMRAP with update_tm amount 2.5', () => {
      const ohpAmrap = allSlots().find(
        (s) => s.trainingMaxKey === 'ohp_tm' && s.tmPercent === 0.85
      );

      expect(ohpAmrap).toBeDefined();
      expect(ohpAmrap?.onSuccess).toEqual({
        type: 'update_tm',
        amount: 2.5,
        minAmrapReps: 5,
      });
    });
  });

  describe('secondary compound configuration (REQ-PPL-003)', () => {
    it('should have OHP secondary compound with no_change rule and secondary role', () => {
      const ohpSec = allSlots().find((s) => s.trainingMaxKey === 'ohp_tm' && s.tmPercent === 0.5);

      expect(ohpSec).toBeDefined();
      expect(ohpSec?.role).toBe('secondary');
      expect(ohpSec?.onSuccess).toEqual({ type: 'no_change' });
      expect(ohpSec?.dayName).toBe('Push A');
    });

    it('should have squat secondary slot using squat_tm at 60%', () => {
      const sqSec = allSlots().find((s) => s.trainingMaxKey === 'squat_tm' && s.tmPercent === 0.6);

      expect(sqSec).toBeDefined();
      expect(sqSec?.dayName).toBe('Legs B');
      expect(sqSec?.role).toBe('secondary');
    });

    it('should have bench secondary compound at 50% TM on Push B', () => {
      const benchSec = allSlots().find(
        (s) => s.trainingMaxKey === 'bench_tm' && s.tmPercent === 0.5
      );

      expect(benchSec).toBeDefined();
      expect(benchSec?.role).toBe('secondary');
      expect(benchSec?.onSuccess).toEqual({ type: 'no_change' });
      expect(benchSec?.dayName).toBe('Push B');
    });
  });

  describe('accessory double progression (REQ-PPL-004)', () => {
    it('should have lat pulldown 8-10 stages with repsMax 10', () => {
      const lp = allSlots().find((s) => s.exerciseId === 'lat_pulldown');

      expect(lp).toBeDefined();
      expect(lp?.role).toBe('accessory');
      expect(lp?.stages).toHaveLength(3);
      expect(lp?.stages.map((s) => s.reps)).toEqual([8, 9, 10]);
      expect(lp?.stages.every((s) => s.repsMax === 10)).toBe(true);
    });

    it('should have face pull 15-20 stages with repsMax 20', () => {
      const fp = allSlots().find((s) => s.exerciseId === 'face_pull');

      expect(fp).toBeDefined();
      expect(fp?.role).toBe('accessory');
      expect(fp?.stages).toHaveLength(6);
      expect(fp?.stages.map((s) => s.reps)).toEqual([15, 16, 17, 18, 19, 20]);
      expect(fp?.stages.every((s) => s.repsMax === 20)).toBe(true);
    });

    it('should have lateral raise with 0.5kg add_weight_reset_stage amount', () => {
      const lr = allSlots().find((s) => s.exerciseId === 'lateral_raise');

      expect(lr).toBeDefined();
      expect(lr?.onFinalStageSuccess).toEqual({
        type: 'add_weight_reset_stage',
        amount: 0.5,
      });
    });

    it('should have hammer curl Pull A and Pull B with distinct slot IDs', () => {
      const hammerSlots = allSlots().filter((s) => s.exerciseId === 'hammer_curl');
      const ids = new Set(hammerSlots.map((s) => s.id));

      expect(ids.size).toBe(2);
      expect(ids.has('hammer_curl_a')).toBe(true);
      expect(ids.has('hammer_curl_b')).toBe(true);
    });

    it('should have hammer curl Pull A with 3 sets and Pull B with 4 sets', () => {
      const pullA = allSlots().find((s) => s.id === 'hammer_curl_a');
      const pullB = allSlots().find((s) => s.id === 'hammer_curl_b');

      expect(pullA?.stages[0].sets).toBe(3);
      expect(pullB?.stages[0].sets).toBe(4);
    });

    it('should have standing calf raise with 5 sets', () => {
      const cr = allSlots().find((s) => s.exerciseId === 'standing_calf_raise');

      expect(cr).toBeDefined();
      expect(cr?.stages[0].sets).toBe(5);
    });

    it('should have incline row with 5 sets', () => {
      const ir = allSlots().find((s) => s.exerciseId === 'incline_row');

      expect(ir).toBeDefined();
      expect(ir?.stages[0].sets).toBe(5);
    });

    it('should have lying bicep curl with 4 sets', () => {
      const lbc = allSlots().find((s) => s.exerciseId === 'lying_bicep_curl');

      expect(lbc).toBeDefined();
      expect(lbc?.stages[0].sets).toBe(4);
    });
  });

  describe('config fields (REQ-PPL-007)', () => {
    it('should include all five TM keys', () => {
      const keys = PPL531_DEFINITION.configFields.map((f) => f.key);

      for (const tmKey of TM_KEYS) {
        expect(keys).toContain(tmKey);
      }
    });

    it('should have all config fields with type weight', () => {
      for (const field of PPL531_DEFINITION.configFields) {
        expect(field.type).toBe('weight');
      }
    });

    it('should have a config field for every unique startWeightKey', () => {
      const startWeightKeys = new Set<string>();
      for (const day of PPL531_DEFINITION.days) {
        for (const slot of day.slots) {
          startWeightKeys.add(slot.startWeightKey);
        }
      }

      const configKeys = new Set(PPL531_DEFINITION.configFields.map((f) => f.key));

      for (const swk of startWeightKeys) {
        expect(configKeys.has(swk)).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 4.9 — Replay Tests
// ---------------------------------------------------------------------------

describe('PPL 5/3/1 replay', () => {
  describe('TM progression after full 6-day cycle (REQ-PPL-005)', () => {
    it('should yield correct TM values after one full successful cycle', () => {
      const config = makeConfig();

      // Mark all AMRAP slots as success with 7 reps (>= 5)
      const results: Record<string, Record<string, { result: 'success'; amrapReps: number }>> = {
        // Day 0 (Pull A): deadlift AMRAP
        '0': { deadlift_main_amrap: { result: 'success', amrapReps: 7 } },
        // Day 1 (Push A): bench AMRAP
        '1': { bench_main_amrap: { result: 'success', amrapReps: 7 } },
        // Day 2 (Legs A): squat AMRAP
        '2': { squat_main_amrap: { result: 'success', amrapReps: 7 } },
        // Day 3 (Pull B): pullup AMRAP
        '3': { pullup_main_amrap: { result: 'success', amrapReps: 7 } },
        // Day 4 (Push B): ohp AMRAP
        '4': { ohp_main_amrap: { result: 'success', amrapReps: 7 } },
      };

      const rows = computeGenericProgram(PPL531_DEFINITION, config, results);

      // After cycle 1, inspect second cycle (workout index 6 = Pull A again)
      // deadlift_tm should be 125 (120 + 5)
      const dl85 = rows[6].slots.find((s) => s.slotId === 'deadlift_main_amrap');
      expect(dl85?.weight).toBe(roundToNearestHalf(125 * 0.85));

      // bench_tm should be 82.5 (80 + 2.5)
      const bench85 = rows[7].slots.find((s) => s.slotId === 'bench_main_amrap');
      expect(bench85?.weight).toBe(roundToNearestHalf(82.5 * 0.85));

      // squat_tm should be 105 (100 + 5)
      const squat85 = rows[8].slots.find((s) => s.slotId === 'squat_main_amrap');
      expect(squat85?.weight).toBe(roundToNearestHalf(105 * 0.85));

      // pullup_tm should be 52.5 (50 + 2.5)
      const pullup85 = rows[9].slots.find((s) => s.slotId === 'pullup_main_amrap');
      expect(pullup85?.weight).toBe(roundToNearestHalf(52.5 * 0.85));

      // ohp_tm should be 62.5 (60 + 2.5)
      const ohp85 = rows[10].slots.find((s) => s.slotId === 'ohp_main_amrap');
      expect(ohp85?.weight).toBe(roundToNearestHalf(62.5 * 0.85));
    });

    it('should increase squat TM by 5 after Legs A AMRAP success', () => {
      const config = makeConfig();

      const results: Record<string, Record<string, { result: 'success'; amrapReps: number }>> = {
        '2': { squat_main_amrap: { result: 'success', amrapReps: 7 } },
      };

      const rows = computeGenericProgram(PPL531_DEFINITION, config, results);

      // Legs B (index 5) has squat secondary at 60% TM
      // TM should now be 105 (100 + 5)
      const sqSec = rows[5].slots.find((s) => s.slotId === 'squat_secondary');
      expect(sqSec?.weight).toBe(roundToNearestHalf(105 * 0.6));
    });

    it('should not increase squat TM when AMRAP is 4 (below minAmrapReps 5)', () => {
      const config = makeConfig();

      const results: Record<string, Record<string, { result: 'success'; amrapReps: number }>> = {
        '2': { squat_main_amrap: { result: 'success', amrapReps: 4 } },
      };

      const rows = computeGenericProgram(PPL531_DEFINITION, config, results);

      // TM unchanged: still 100
      const sqSec = rows[5].slots.find((s) => s.slotId === 'squat_secondary');
      expect(sqSec?.weight).toBe(roundToNearestHalf(100 * 0.6));
    });

    it('should advance accessory double progression from stage 0 to stage 1 after success', () => {
      const config = makeConfig();

      const results: Record<string, Record<string, { result: 'success' }>> = {
        '0': { lat_pulldown: { result: 'success' } },
      };

      const rows = computeGenericProgram(PPL531_DEFINITION, config, results);

      // Lat pulldown appears next on Pull A (workout index 6)
      const lp = rows[6].slots.find((s) => s.slotId === 'lat_pulldown');
      expect(lp?.reps).toBe(9);
      expect(lp?.repsMax).toBe(10);
    });
  });

  describe('secondary compound weights (initial)', () => {
    it('should display OHP secondary at 50% of OHP TM', () => {
      const config = makeConfig();
      const rows = computeGenericProgram(PPL531_DEFINITION, config, {});

      // Push A (index 1) has OHP secondary at 50% of 60 = 30
      const ohpSec = rows[1].slots.find((s) => s.slotId === 'ohp_secondary');
      expect(ohpSec?.weight).toBe(30);
    });

    it('should display bench secondary at 50% of bench TM', () => {
      const config = makeConfig();
      const rows = computeGenericProgram(PPL531_DEFINITION, config, {});

      // Push B (index 4) has bench secondary at 50% of 80 = 40
      const benchSec = rows[4].slots.find((s) => s.slotId === 'bench_secondary');
      expect(benchSec?.weight).toBe(40);
    });

    it('should display squat secondary at 60% of squat TM', () => {
      const config = makeConfig();
      const rows = computeGenericProgram(PPL531_DEFINITION, config, {});

      // Legs B (index 5) has squat secondary at 60% of 100 = 60
      const sqSec = rows[5].slots.find((s) => s.slotId === 'squat_secondary');
      expect(sqSec?.weight).toBe(60);
    });
  });

  describe('main lift initial weights', () => {
    it('should display deadlift AMRAP at 85% of deadlift TM', () => {
      const config = makeConfig();
      const rows = computeGenericProgram(PPL531_DEFINITION, config, {});

      // Pull A (index 0): deadlift 85% of 120 = 102
      const dlAmrap = rows[0].slots.find((s) => s.slotId === 'deadlift_main_amrap');
      expect(dlAmrap?.weight).toBe(roundToNearestHalf(120 * 0.85));
    });

    it('should display deadlift work set at 75% of deadlift TM', () => {
      const config = makeConfig();
      const rows = computeGenericProgram(PPL531_DEFINITION, config, {});

      // Pull A (index 0): deadlift 75% of 120 = 90
      const dlWork = rows[0].slots.find((s) => s.slotId === 'deadlift_main_work');
      expect(dlWork?.weight).toBe(roundToNearestHalf(120 * 0.75));
    });
  });
});

// ---------------------------------------------------------------------------
// 4.10 — Registry Tests
// ---------------------------------------------------------------------------

describe('PPL 5/3/1 registry (REQ-PPL-006)', () => {
  it('should return PPL531_DEFINITION by ID', () => {
    const ppl = getProgramDefinition('ppl531');

    expect(ppl).toBeDefined();
    expect(ppl?.id).toBe('ppl531');
    expect(ppl?.name).toBe('PPL 5/3/1 + Double Progression');
  });

  it('should include ppl531 in getAllPresetPrograms', () => {
    const all = getAllPresetPrograms();

    expect(all.some((p) => p.id === 'ppl531')).toBe(true);
  });

  it('should still return GZCLP definition (no regression)', () => {
    const gzclp = getProgramDefinition('gzclp');

    expect(gzclp).toBeDefined();
    expect(gzclp?.id).toBe('gzclp');
  });
});
