import { describe, it, expect } from 'bun:test';
import {
  ProgressionRuleSchema,
  StageDefinitionSchema,
} from '@gzclp/shared/schemas/program-definition';
import { PROGRESSION_TEMPLATES } from './progression-templates';

// ---------------------------------------------------------------------------
// PROGRESSION_TEMPLATES — schema validation for all 5 built-in templates
// ---------------------------------------------------------------------------

describe('PROGRESSION_TEMPLATES', () => {
  it('exports exactly 5 templates', () => {
    expect(PROGRESSION_TEMPLATES.length).toBe(5);
  });

  it('has unique ids across all templates', () => {
    const ids = PROGRESSION_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  for (const template of PROGRESSION_TEMPLATES) {
    describe(template.id, () => {
      describe('onSuccess', () => {
        it('parses through ProgressionRuleSchema without errors', () => {
          const result = ProgressionRuleSchema.safeParse(template.onSuccess);
          expect(result.success).toBe(true);
        });
      });

      describe('onMidStageFail', () => {
        it('parses through ProgressionRuleSchema without errors', () => {
          const result = ProgressionRuleSchema.safeParse(template.onMidStageFail);
          expect(result.success).toBe(true);
        });
      });

      describe('onFinalStageFail', () => {
        it('parses through ProgressionRuleSchema without errors', () => {
          const result = ProgressionRuleSchema.safeParse(template.onFinalStageFail);
          expect(result.success).toBe(true);
        });
      });

      describe('defaultStages', () => {
        it('has at least one stage', () => {
          expect(template.defaultStages.length).toBeGreaterThan(0);
        });

        for (let i = 0; i < template.defaultStages.length; i++) {
          const stage = template.defaultStages[i];
          it(`stage[${i}] parses through StageDefinitionSchema without errors`, () => {
            const result = StageDefinitionSchema.safeParse(stage);
            expect(result.success).toBe(true);
          });
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Per-template structural assertions (beyond schema validity)
// ---------------------------------------------------------------------------

describe('PROGRESSION_TEMPLATES[linear]', () => {
  const template = PROGRESSION_TEMPLATES.find((t) => t.id === 'linear');

  it('exists in the array', () => {
    expect(template).toBeDefined();
  });

  it('uses add_weight on success', () => {
    expect(template?.onSuccess.type).toBe('add_weight');
  });

  it('uses advance_stage on mid-stage fail', () => {
    expect(template?.onMidStageFail.type).toBe('advance_stage');
  });

  it('uses deload_percent on final-stage fail', () => {
    expect(template?.onFinalStageFail.type).toBe('deload_percent');
  });

  it('has 3 default stages', () => {
    expect(template?.defaultStages.length).toBe(3);
  });
});

describe('PROGRESSION_TEMPLATES[double-progression]', () => {
  const template = PROGRESSION_TEMPLATES.find((t) => t.id === 'double-progression');

  it('exists in the array', () => {
    expect(template).toBeDefined();
  });

  it('uses double_progression on success', () => {
    expect(template?.onSuccess.type).toBe('double_progression');
  });

  it('has repRangeBottom <= repRangeTop', () => {
    const rule = template?.onSuccess;
    // Narrow to double_progression to access rep range fields.
    // If narrowing fails, the assertion is skipped; the sibling test catches the wrong type.
    if (rule?.type !== 'double_progression') {
      return;
    }
    expect(rule.repRangeBottom).toBeLessThanOrEqual(rule.repRangeTop);
  });

  it('has 1 default stage', () => {
    expect(template?.defaultStages.length).toBe(1);
  });
});

describe('PROGRESSION_TEMPLATES[linear-t2]', () => {
  const template = PROGRESSION_TEMPLATES.find((t) => t.id === 'linear-t2');

  it('exists in the array', () => {
    expect(template).toBeDefined();
  });

  it('uses add_weight_reset_stage on final-stage fail', () => {
    expect(template?.onFinalStageFail.type).toBe('add_weight_reset_stage');
  });

  it('has 3 default stages', () => {
    expect(template?.defaultStages.length).toBe(3);
  });
});

describe('PROGRESSION_TEMPLATES[accessory]', () => {
  const template = PROGRESSION_TEMPLATES.find((t) => t.id === 'accessory');

  it('exists in the array', () => {
    expect(template).toBeDefined();
  });

  it('uses double_progression on success', () => {
    expect(template?.onSuccess.type).toBe('double_progression');
  });

  it('uses no_change on final-stage fail', () => {
    expect(template?.onFinalStageFail.type).toBe('no_change');
  });
});

describe('PROGRESSION_TEMPLATES[no-progression]', () => {
  const template = PROGRESSION_TEMPLATES.find((t) => t.id === 'no-progression');

  it('exists in the array', () => {
    expect(template).toBeDefined();
  });

  it('uses no_change on success', () => {
    expect(template?.onSuccess.type).toBe('no_change');
  });

  it('uses no_change on mid-stage fail', () => {
    expect(template?.onMidStageFail.type).toBe('no_change');
  });

  it('uses no_change on final-stage fail', () => {
    expect(template?.onFinalStageFail.type).toBe('no_change');
  });

  it('has 1 default stage', () => {
    expect(template?.defaultStages.length).toBe(1);
  });
});
