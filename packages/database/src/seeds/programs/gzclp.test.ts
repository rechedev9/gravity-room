import { describe, it, expect } from 'vitest';
import { GZCLP_DEFINITION_JSONB } from './gzclp';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

const GZCLP_META = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'test',
  author: 'Cody Lefever',
  version: 1,
  category: 'strength' as const,
  source: 'preset' as const,
} as const;

function hydratedDefinition(): ProgramDefinition {
  const merged = { ...GZCLP_META, ...GZCLP_DEFINITION_JSONB };
  const parsed = ProgramDefinitionSchema.safeParse({
    ...merged,
    exercises: Object.fromEntries(
      Object.keys(merged.exercises as Record<string, unknown>).map((id) => [id, { name: id }])
    ),
  });
  if (!parsed.success) {
    throw new Error(`GZCLP fixture invalid: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}

describe('gzclp seed', () => {
  describe('schema validation', () => {
    it('passes ProgramDefinitionSchema.safeParse', () => {
      const result = ProgramDefinitionSchema.safeParse({
        ...GZCLP_META,
        ...GZCLP_DEFINITION_JSONB,
        exercises: Object.fromEntries(
          Object.keys(GZCLP_DEFINITION_JSONB.exercises).map((id) => [id, { name: id }])
        ),
      });
      if (!result.success) {
        console.error('gzclp failed:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  });

  describe('structure', () => {
    it('has a 4-day cycle and 90 total workouts', () => {
      expect(GZCLP_DEFINITION_JSONB.cycleLength).toBe(4);
      expect(GZCLP_DEFINITION_JSONB.days).toHaveLength(4);
      expect(GZCLP_DEFINITION_JSONB.totalWorkouts).toBe(90);
    });

    it('gives every day T1/T2/T3 slots with expected progression rules', () => {
      for (const day of GZCLP_DEFINITION_JSONB.days) {
        expect(day.slots).toHaveLength(3);
        const [t1, t2, t3] = day.slots;
        expect(t1?.tier).toBe('t1');
        expect(t1?.onSuccess).toEqual({ type: 'add_weight' });
        expect(t1?.onMidStageFail).toEqual({ type: 'advance_stage' });
        expect(t1?.onFinalStageFail).toEqual({ type: 'deload_percent', percent: 10 });
        expect(t1?.stages).toHaveLength(3);

        expect(t2?.tier).toBe('t2');
        expect(t2?.startWeightMultiplier).toBe(0.65);
        expect(t2?.onFinalStageFail).toEqual({ type: 'add_weight_reset_stage', amount: 15 });

        expect(t3?.tier).toBe('t3');
        expect(t3?.onUndefined).toEqual({ type: 'no_change' });
      }
    });
  });

  describe('engine smoke', () => {
    it('materializes the first 12 workouts without throwing', () => {
      const definition = hydratedDefinition();
      const config = {
        squat: 60,
        bench: 40,
        deadlift: 80,
        ohp: 30,
        latpulldown: 30,
        dbrow: 15,
      };
      const rows = computeGenericProgram(definition, config, {}, { maxRows: 12 });

      expect(rows).toHaveLength(12);
      expect(rows[0]?.slots).toHaveLength(3);
      expect(rows[0]?.dayName).toBe('Día 1');
      expect(rows[0]?.slots[0]?.weight).toBe(60);
      expect(rows[0]?.slots[1]?.weight).toBe(25); // 40 * 0.65 → 25
      expect(rows[4]?.dayName).toBe('Día 1');
    });

    it('bumps T1 weight after an explicit success on the prior cycle', () => {
      const definition = hydratedDefinition();
      const results = {
        '0': {
          'd1-t1': { result: 'success' as const },
          'd1-t2': { result: 'success' as const },
          'latpulldown-t3': { result: 'success' as const },
        },
      };
      const rows = computeGenericProgram(
        definition,
        {
          squat: 60,
          bench: 40,
          deadlift: 80,
          ohp: 30,
          latpulldown: 30,
          dbrow: 15,
        },
        results,
        { maxRows: 5 }
      );

      expect(rows[4]?.slots[0]?.weight).toBe(65);
    });
  });
});
