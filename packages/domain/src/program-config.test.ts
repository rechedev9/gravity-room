import { describe, expect, it } from 'vitest';

import { validateProgramConfig } from './program-config';
import type { ProgramDefinition } from './schemas/program-definition';

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
});
