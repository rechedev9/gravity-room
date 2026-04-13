import { describe, it, expect } from 'bun:test';
import { SALA_1_DEFINITION_JSONB } from './sala-1';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';

// ---------------------------------------------------------------------------
// Helpers — merge metadata for schema validation
// ---------------------------------------------------------------------------

const SALA_1_META = {
  id: 'sala-del-tiempo-1',
  name: 'La Sala del Tiempo 1',
  description: 'test',
  author: 'test',
  version: 1,
  category: 'hypertrophy' as const,
  source: 'preset' as const,
} as const;

function hydratedDefinition(): Record<string, unknown> {
  const merged = { ...SALA_1_META, ...SALA_1_DEFINITION_JSONB };
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

describe('sala-1 (Perfezionamento Tecnico)', () => {
  describe('schema validation', () => {
    it('should pass ProgramDefinitionSchema.safeParse', () => {
      const result = ProgramDefinitionSchema.safeParse(hydratedDefinition());

      if (!result.success) {
        console.error('sala-1 failed:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  });

  describe('structure', () => {
    it('should have exactly 24 days', () => {
      expect(SALA_1_DEFINITION_JSONB.days.length).toBe(24);
    });

    it('should have cycleLength equal to 24', () => {
      expect(SALA_1_DEFINITION_JSONB.cycleLength).toBe(24);
    });

    it('should have totalWorkouts equal to 24', () => {
      expect(SALA_1_DEFINITION_JSONB.totalWorkouts).toBe(24);
    });
  });

  describe('configFields', () => {
    const configKeys = SALA_1_DEFINITION_JSONB.configFields.map(
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
