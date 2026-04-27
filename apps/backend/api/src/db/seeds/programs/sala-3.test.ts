import { describe, it, expect } from 'bun:test';
import { SALA_3_DEFINITION_JSONB } from './sala-3';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';

// ---------------------------------------------------------------------------
// Types (test-only)
// ---------------------------------------------------------------------------

type SlotLike = {
  readonly id: string;
  readonly exerciseId?: string;
  readonly isTestSlot?: boolean;
  readonly propagatesTo?: string;
  readonly tmPercent?: number;
  readonly stages?: readonly { readonly sets: number; readonly reps: number }[];
};

type DayLike = {
  readonly name: string;
  readonly slots: readonly SlotLike[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SALA_3_META = {
  id: 'sala-del-tiempo-3',
  name: 'La Sala del Tiempo 3',
  description: 'test',
  author: 'test',
  version: 1,
  category: 'hypertrophy' as const,
  source: 'preset' as const,
} as const;

function hydratedDefinition(): Record<string, unknown> {
  const merged = { ...SALA_3_META, ...SALA_3_DEFINITION_JSONB };
  return {
    ...merged,
    exercises: Object.fromEntries(
      Object.keys(merged.exercises as Record<string, unknown>).map((id) => [id, { name: id }])
    ),
  };
}

const days = SALA_3_DEFINITION_JSONB.days as readonly DayLike[];

/** Find the test-week day for a given block and lift name. */
function findTestSlot(blockNum: number, liftName: string): SlotLike | undefined {
  const dayNamePattern = `JAW Mod Bloque ${blockNum} — Test Maximo ${liftName}`;
  const day = days.find((d) => d.name === dayNamePattern);
  return day?.slots[0];
}

/** Find the first slot matching exerciseId in a given day. */
function findSlotByExercise(day: DayLike, exerciseId: string): SlotLike | undefined {
  return day.slots.find((s) => s.exerciseId === exerciseId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sala-3 (JAW Mod)', () => {
  // =========================================================================
  // Schema validation
  // =========================================================================

  describe('schema validation', () => {
    it('should pass ProgramDefinitionSchema.safeParse', () => {
      const result = ProgramDefinitionSchema.safeParse(hydratedDefinition());

      if (!result.success) {
        console.error('sala-3 failed:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Structure
  // =========================================================================

  describe('structure', () => {
    it('should have exactly 72 days', () => {
      expect(SALA_3_DEFINITION_JSONB.days.length).toBe(72);
    });

    it('should have cycleLength equal to 72', () => {
      expect(SALA_3_DEFINITION_JSONB.cycleLength).toBe(72);
    });

    it('should have totalWorkouts equal to 72', () => {
      expect(SALA_3_DEFINITION_JSONB.totalWorkouts).toBe(72);
    });
  });

  // =========================================================================
  // configFields
  // =========================================================================

  describe('configFields', () => {
    const configKeys = SALA_3_DEFINITION_JSONB.configFields.map(
      (f: { readonly key: string }) => f.key
    );

    it('should contain all 9 JAW TM keys', () => {
      const expectedKeys = [
        'squat_jaw_b1_tm',
        'bench_jaw_b1_tm',
        'deadlift_jaw_b1_tm',
        'squat_jaw_b2_tm',
        'bench_jaw_b2_tm',
        'deadlift_jaw_b2_tm',
        'squat_jaw_b3_tm',
        'bench_jaw_b3_tm',
        'deadlift_jaw_b3_tm',
      ];

      for (const key of expectedKeys) {
        expect(configKeys).toContain(key);
      }
    });

    it('should NOT contain base squat_tm/bench_tm/deadlift_tm keys', () => {
      expect(configKeys).not.toContain('squat_tm');
      expect(configKeys).not.toContain('bench_tm');
      expect(configKeys).not.toContain('deadlift_tm');
    });
  });

  // =========================================================================
  // JAW Mod percentages
  // =========================================================================

  describe('JAW Mod percentages', () => {
    // Block 1 — Week 1 (day index 0 = B1 Sem. 1 Dia 1)
    it('should have B1 Week 1 squat pct = 0.60, sets = 10, reps = 6', () => {
      const day = days[0];
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.6);
      expect(slot.stages![0].sets).toBe(10);
      expect(slot.stages![0].reps).toBe(6);
    });

    // Block 1 — Week 5 (deload): days 0..15 = weeks 1-4 (4 days each), days 16..19 = week 5
    it('should have B1 Week 5 (deload) squat pct = 0.70, sets = 5, reps = 4', () => {
      const day = days[16]; // First day of week 5
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.7);
      expect(slot.stages![0].sets).toBe(5);
      expect(slot.stages![0].reps).toBe(4);
    });

    // Block 2 — Week 7 (first training week of B2)
    // B1 = 24 days (5 training weeks x 4 days + 4 test week days), B2 starts at day 24
    it('should have B2 Week 7 squat pct = 0.70, sets = 6, reps = 6', () => {
      const day = days[24]; // First day of B2
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.7);
      expect(slot.stages![0].sets).toBe(6);
      expect(slot.stages![0].reps).toBe(6);
    });

    // Block 2 — Week 11 (deload): B2 days 16..19 = deload week
    it('should have B2 Week 11 (deload) squat pct = 0.80, sets = 3, reps = 5', () => {
      const day = days[24 + 16]; // Day 40, first day of B2 deload week
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.8);
      expect(slot.stages![0].sets).toBe(3);
      expect(slot.stages![0].reps).toBe(5);
    });

    // Block 3 — Week 13 (first training week of B3)
    // B3 starts at day 48
    it('should have B3 Week 13 squat pct = 0.80, sets = 3, reps = 6', () => {
      const day = days[48]; // First day of B3
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.8);
      expect(slot.stages![0].sets).toBe(3);
      expect(slot.stages![0].reps).toBe(6);
    });

    // Block 3 — Week 17 (deload): B3 days 16..19
    it('should have B3 Week 17 (deload) squat pct = 0.90, sets = 2, reps = 3', () => {
      const day = days[48 + 16]; // Day 64, first day of B3 deload week
      const slot = findSlotByExercise(day, 'squat')!;

      expect(slot.tmPercent).toBe(0.9);
      expect(slot.stages![0].sets).toBe(2);
      expect(slot.stages![0].reps).toBe(3);
    });
  });

  // =========================================================================
  // Bench B1 reps (8, not 10)
  // =========================================================================

  describe('bench B1 reps constraint', () => {
    it('should have B1 Week 1 bench slot with reps = 8', () => {
      const day = days[0]; // B1 Week 1 Day 1 — has both squat and bench
      const benchSlot = findSlotByExercise(day, 'bench')!;

      expect(benchSlot.stages![0].reps).toBe(8);
    });

    it('should have B1 Week 1 squat slot with reps = 6 (confirming 8-rep rule is bench-only)', () => {
      const day = days[0];
      const squatSlot = findSlotByExercise(day, 'squat')!;

      expect(squatSlot.stages![0].reps).toBe(6);
    });

    it('should have B2 bench slots using the same reps as squat (6)', () => {
      const day = days[24]; // B2 Week 7 Day 1
      const benchSlot = findSlotByExercise(day, 'bench')!;
      const squatSlot = findSlotByExercise(day, 'squat')!;

      expect(benchSlot.stages![0].reps).toBe(squatSlot.stages![0].reps);
    });

    it('should have B3 bench slots using the same reps as squat (3 via B3 schedule)', () => {
      const day = days[48]; // B3 Week 13 Day 1
      const benchSlot = findSlotByExercise(day, 'bench')!;
      const squatSlot = findSlotByExercise(day, 'squat')!;

      expect(benchSlot.stages![0].reps).toBe(squatSlot.stages![0].reps);
    });
  });

  // =========================================================================
  // propagatesTo chain verification
  // =========================================================================

  describe('propagatesTo wiring', () => {
    describe('B1 test slots propagate to B2 TM keys', () => {
      it('should set B1 squat test slot propagatesTo to squat_jaw_b2_tm', () => {
        const slot = findTestSlot(1, 'Sentadilla');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('squat_jaw_b2_tm');
      });

      it('should set B1 bench test slot propagatesTo to bench_jaw_b2_tm', () => {
        const slot = findTestSlot(1, 'Press Banca');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('bench_jaw_b2_tm');
      });

      it('should set B1 deadlift test slot propagatesTo to deadlift_jaw_b2_tm', () => {
        const slot = findTestSlot(1, 'Peso Muerto');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('deadlift_jaw_b2_tm');
      });
    });

    describe('B2 test slots propagate to B3 TM keys', () => {
      it('should set B2 squat test slot propagatesTo to squat_jaw_b3_tm', () => {
        const slot = findTestSlot(2, 'Sentadilla');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('squat_jaw_b3_tm');
      });

      it('should set B2 bench test slot propagatesTo to bench_jaw_b3_tm', () => {
        const slot = findTestSlot(2, 'Press Banca');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('bench_jaw_b3_tm');
      });

      it('should set B2 deadlift test slot propagatesTo to deadlift_jaw_b3_tm', () => {
        const slot = findTestSlot(2, 'Peso Muerto');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBe('deadlift_jaw_b3_tm');
      });
    });

    describe('B3 test slots have no propagatesTo (last block)', () => {
      it('should set B3 squat test slot propagatesTo to undefined', () => {
        const slot = findTestSlot(3, 'Sentadilla');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBeUndefined();
      });

      it('should set B3 bench test slot propagatesTo to undefined', () => {
        const slot = findTestSlot(3, 'Press Banca');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBeUndefined();
      });

      it('should set B3 deadlift test slot propagatesTo to undefined', () => {
        const slot = findTestSlot(3, 'Peso Muerto');

        expect(slot).toBeDefined();
        expect(slot!.propagatesTo).toBeUndefined();
      });
    });

    describe('isTestSlot markers', () => {
      it('should have isTestSlot: true on all 9 test slots', () => {
        const lifts = ['Sentadilla', 'Press Banca', 'Peso Muerto'];
        const blocks = [1, 2, 3];

        for (const block of blocks) {
          for (const lift of lifts) {
            const slot = findTestSlot(block, lift);
            expect(slot).toBeDefined();
            expect(slot!.isTestSlot).toBe(true);
          }
        }
      });

      it('should not have isTestSlot: true on any non-test-week day', () => {
        const testDayNames = new Set<string>();
        for (const block of [1, 2, 3]) {
          for (const lift of ['Sentadilla', 'Press Banca', 'Peso Muerto']) {
            testDayNames.add(`JAW Mod Bloque ${block} — Test Maximo ${lift}`);
          }
        }

        for (const day of days) {
          if (testDayNames.has(day.name)) continue;

          for (const slot of day.slots) {
            expect(slot.isTestSlot).not.toBe(true);
          }
        }
      });
    });
  });
});
