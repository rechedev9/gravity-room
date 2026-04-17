import { describe, it, expect } from 'bun:test';
import { BRUNETTI365_EXP_DEFINITION_JSONB, BRUNETTI365_DEFINITION_JSONB } from './brunetti-365';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';

// ---------------------------------------------------------------------------
// Helpers — find JAW test slots by day name pattern
// ---------------------------------------------------------------------------

type SlotLike = {
  readonly id: string;
  readonly isTestSlot?: boolean;
  readonly propagatesTo?: string;
};

type DayLike = {
  readonly name: string;
  readonly slots: readonly SlotLike[];
};

function findTestSlot(
  days: readonly DayLike[],
  blockNum: number,
  liftName: string
): SlotLike | undefined {
  const dayNamePattern = `JAW Bloque ${blockNum} — Test Maximo ${liftName}`;
  const day = days.find((d) => d.name === dayNamePattern);
  return day?.slots[0];
}

// ---------------------------------------------------------------------------
// maxTestSlot() behavior (tested via exported definition)
// ---------------------------------------------------------------------------

describe('brunetti-365 JAW test slots', () => {
  const days = BRUNETTI365_EXP_DEFINITION_JSONB.days as readonly DayLike[];

  describe('maxTestSlot() with propagatesTo (B1 and B2)', () => {
    it('should set isTestSlot: true on all test slots', () => {
      const b1Squat = findTestSlot(days, 1, 'Sentadilla');

      expect(b1Squat).toBeDefined();
      expect(b1Squat!.isTestSlot).toBe(true);
    });

    it('should set B1 squat test slot propagatesTo to squat_jaw_b2_tm', () => {
      const slot = findTestSlot(days, 1, 'Sentadilla');

      expect(slot!.propagatesTo).toBe('squat_jaw_b2_tm');
    });

    it('should set B1 bench test slot propagatesTo to bench_jaw_b2_tm', () => {
      const slot = findTestSlot(days, 1, 'Press Banca');

      expect(slot!.propagatesTo).toBe('bench_jaw_b2_tm');
    });

    it('should set B1 deadlift test slot propagatesTo to deadlift_jaw_b2_tm', () => {
      const slot = findTestSlot(days, 1, 'Peso Muerto');

      expect(slot!.propagatesTo).toBe('deadlift_jaw_b2_tm');
    });

    it('should set B2 squat test slot propagatesTo to squat_jaw_b3_tm', () => {
      const slot = findTestSlot(days, 2, 'Sentadilla');

      expect(slot!.propagatesTo).toBe('squat_jaw_b3_tm');
    });

    it('should set B2 bench test slot propagatesTo to bench_jaw_b3_tm', () => {
      const slot = findTestSlot(days, 2, 'Press Banca');

      expect(slot!.propagatesTo).toBe('bench_jaw_b3_tm');
    });

    it('should set B2 deadlift test slot propagatesTo to deadlift_jaw_b3_tm', () => {
      const slot = findTestSlot(days, 2, 'Peso Muerto');

      expect(slot!.propagatesTo).toBe('deadlift_jaw_b3_tm');
    });
  });

  describe('maxTestSlot() without propagatesTo (B3)', () => {
    it('should set B3 squat test slot propagatesTo to undefined', () => {
      const slot = findTestSlot(days, 3, 'Sentadilla');

      expect(slot).toBeDefined();
      expect(slot!.propagatesTo).toBeUndefined();
    });

    it('should set B3 bench test slot propagatesTo to undefined', () => {
      const slot = findTestSlot(days, 3, 'Press Banca');

      expect(slot).toBeDefined();
      expect(slot!.propagatesTo).toBeUndefined();
    });

    it('should set B3 deadlift test slot propagatesTo to undefined', () => {
      const slot = findTestSlot(days, 3, 'Peso Muerto');

      expect(slot).toBeDefined();
      expect(slot!.propagatesTo).toBeUndefined();
    });

    it('should still set isTestSlot: true on B3 test slots', () => {
      const slot = findTestSlot(days, 3, 'Sentadilla');

      expect(slot!.isTestSlot).toBe(true);
    });
  });

  describe('full definition schema validation', () => {
    it('should pass ProgramDefinitionSchema.safeParse for EXP variant', () => {
      const result = ProgramDefinitionSchema.safeParse(BRUNETTI365_EXP_DEFINITION_JSONB);

      expect(result.success).toBe(true);
    });

    it('should pass ProgramDefinitionSchema.safeParse for full variant', () => {
      const result = ProgramDefinitionSchema.safeParse(BRUNETTI365_DEFINITION_JSONB);

      expect(result.success).toBe(true);
    });
  });
});
