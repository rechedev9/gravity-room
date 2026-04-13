import { describe, it, expect } from 'bun:test';
import { SALA_2_DEFINITION_JSONB } from './sala-2';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';

// ---------------------------------------------------------------------------
// Helpers — merge metadata for schema validation
// ---------------------------------------------------------------------------

const SALA_2_META = {
  id: 'sala-del-tiempo-2',
  name: 'La Sala del Tiempo 2',
  description: 'test',
  author: 'test',
  version: 1,
  category: 'hypertrophy' as const,
  source: 'preset' as const,
} as const;

function hydratedDefinition(): Record<string, unknown> {
  const merged = { ...SALA_2_META, ...SALA_2_DEFINITION_JSONB };
  return {
    ...merged,
    exercises: Object.fromEntries(
      Object.keys(merged.exercises as Record<string, unknown>).map((id) => [id, { name: id }])
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sala-2 (Potenziamento Neurale)', () => {
  describe('schema validation', () => {
    it('should pass ProgramDefinitionSchema.safeParse', () => {
      const result = ProgramDefinitionSchema.safeParse(hydratedDefinition());

      if (!result.success) {
        console.error('sala-2 failed:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  });

  describe('structure', () => {
    it('should have exactly 52 days', () => {
      expect(SALA_2_DEFINITION_JSONB.days.length).toBe(52);
    });

    it('should have cycleLength equal to 52', () => {
      expect(SALA_2_DEFINITION_JSONB.cycleLength).toBe(52);
    });

    it('should have totalWorkouts equal to 52', () => {
      expect(SALA_2_DEFINITION_JSONB.totalWorkouts).toBe(52);
    });
  });

  describe('configFields', () => {
    const configKeys = SALA_2_DEFINITION_JSONB.configFields.map(
      (f: { readonly key: string }) => f.key
    );

    it('should contain squat_tm', () => {
      expect(configKeys).toContain('squat_tm');
    });

    it('should contain bench_tm', () => {
      expect(configKeys).toContain('bench_tm');
    });

    it('should contain deadlift_tm', () => {
      expect(configKeys).toContain('deadlift_tm');
    });

    it('should NOT contain any JAW block TM key', () => {
      const jawKeys = configKeys.filter((k: string) => k.includes('_jaw_b'));

      expect(jawKeys).toHaveLength(0);
    });
  });
});
