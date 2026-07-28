import { describe, expect, it } from 'vitest';

import { canonicalProgramCreationIntent, validateProgramConfig } from './program-config';
import {
  MAX_PROGRAM_WEIGHT,
  MIN_POSITIVE_PROGRAM_WEIGHT,
  type ProgramDefinition,
} from './schemas/program-definition';

const DEFINITION = {
  id: 'test-program',
  name: 'Test program',
  description: 'Config validation fixture',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 'T1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      options: [
        { label: 'Classic', value: 'classic' },
        { label: 'Compact', value: 'compact' },
      ],
    },
  ],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

describe('validateProgramConfig', () => {
  it('canonicalizes program creation identity across whitespace and config key order', () => {
    expect(
      canonicalProgramCreationIntent('gzclp', '  GZCLP  ', {
        variant: 'classic',
        squat: 20,
      })
    ).toBe(
      canonicalProgramCreationIntent('gzclp', 'GZCLP', {
        squat: 20,
        variant: 'classic',
      })
    );
  });

  it('preserves __proto__ as a normal JSON key in the canonical creation identity', () => {
    const config = JSON.parse('{"squat":20,"__proto__":{"nested":true},"variant":"classic"}');

    expect(canonicalProgramCreationIntent('gzclp', 'GZCLP', config)).toBe(
      '{"programId":"gzclp","name":"GZCLP","config":{"__proto__":{"nested":true},"squat":20,"variant":"classic"}}'
    );
  });

  it('accepts a complete setup aligned with the definition', () => {
    expect(validateProgramConfig(DEFINITION, { squat: 27.5, variant: 'classic' })).toEqual({
      success: true,
      config: { squat: 27.5, variant: 'classic' },
    });
  });

  it.each([
    [{ variant: 'classic' }, 'missing', 'squat'],
    [{ squat: '20', variant: 'classic' }, 'invalid_weight', 'squat'],
    [{ squat: 17.5, variant: 'classic' }, 'below_minimum', 'squat'],
    [{ squat: 21, variant: 'classic' }, 'invalid_step', 'squat'],
    [{ squat: 20, variant: 'unknown' }, 'invalid_option', 'variant'],
    [{ squat: 20, variant: 'classic', extra: 1 }, 'unexpected', 'extra'],
  ])('rejects setup %o with %s', (config, code, fieldKey) => {
    const result = validateProgramConfig(DEFINITION, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual({ code, fieldKey });
    }
  });

  it('rejects a malformed definition before considering setup values', () => {
    expect(validateProgramConfig({ id: 'broken' }, {})).toEqual({
      success: false,
      issues: [{ code: 'invalid_definition', fieldKey: null }],
    });
  });

  it('accepts boundary weights and rejects values outside the shared UI range', () => {
    const boundaryDefinition = {
      ...DEFINITION,
      configFields: [
        {
          key: 'squat',
          label: 'Squat',
          type: 'weight' as const,
          min: MIN_POSITIVE_PROGRAM_WEIGHT,
          step: MIN_POSITIVE_PROGRAM_WEIGHT,
        },
        {
          key: 'variant',
          label: 'Variant',
          type: 'select' as const,
          options: [
            { label: 'Classic', value: 'classic' },
            { label: 'Compact', value: 'compact' },
          ],
        },
      ],
    };

    expect(
      validateProgramConfig(boundaryDefinition, {
        squat: MAX_PROGRAM_WEIGHT,
        variant: 'classic',
      }).success
    ).toBe(true);
    expect(
      validateProgramConfig(boundaryDefinition, { squat: 1e-7, variant: 'classic' }).success
    ).toBe(false);
    expect(
      validateProgramConfig(boundaryDefinition, { squat: 1e21, variant: 'classic' }).success
    ).toBe(false);
  });
});
