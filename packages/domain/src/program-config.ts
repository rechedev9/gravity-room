import { ProgramConfigSchema } from './schemas/instance';
import { ProgramDefinitionSchema, type ProgramDefinition } from './schemas/program-definition';

export type ProgramConfig = Readonly<Record<string, number | string>>;

export type ProgramConfigIssueCode =
  | 'invalid_definition'
  | 'invalid_config'
  | 'missing'
  | 'unexpected'
  | 'invalid_weight'
  | 'below_minimum'
  | 'invalid_step'
  | 'invalid_option';

export interface ProgramConfigIssue {
  readonly code: ProgramConfigIssueCode;
  readonly fieldKey: string | null;
}

export type ProgramConfigValidationResult =
  | { readonly success: true; readonly config: ProgramConfig }
  | { readonly success: false; readonly issues: readonly ProgramConfigIssue[] };

const STEP_TOLERANCE = 1e-8;

function isAlignedToStep(value: number, minimum: number, step: number): boolean {
  const steps = (value - minimum) / step;
  return Math.abs(steps - Math.round(steps)) <= STEP_TOLERANCE;
}

function validateDefinition(value: unknown): ProgramDefinition | null {
  const result = ProgramDefinitionSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Validates instance setup against the canonical ProgramDefinition.
 *
 * This relationship cannot be expressed by the generic ProgramConfigSchema
 * alone: field keys, minimum weights, increments and select options come from
 * the selected definition.
 */
export function validateProgramConfig(
  definitionValue: unknown,
  configValue: unknown
): ProgramConfigValidationResult {
  const definition = validateDefinition(definitionValue);
  if (definition === null) {
    return {
      success: false,
      issues: [{ code: 'invalid_definition', fieldKey: null }],
    };
  }

  const configResult = ProgramConfigSchema.safeParse(configValue);
  if (!configResult.success) {
    return {
      success: false,
      issues: [{ code: 'invalid_config', fieldKey: null }],
    };
  }

  const config = configResult.data;
  const issues: ProgramConfigIssue[] = [];
  const expectedKeys = new Set(definition.configFields.map((field) => field.key));

  for (const key of Object.keys(config)) {
    if (!expectedKeys.has(key)) {
      issues.push({ code: 'unexpected', fieldKey: key });
    }
  }

  for (const field of definition.configFields) {
    const value = config[field.key];
    if (value === undefined) {
      issues.push({ code: 'missing', fieldKey: field.key });
      continue;
    }

    if (field.type === 'weight') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ code: 'invalid_weight', fieldKey: field.key });
        continue;
      }
      if (value < field.min) {
        issues.push({ code: 'below_minimum', fieldKey: field.key });
        continue;
      }
      if (!isAlignedToStep(value, field.min, field.step)) {
        issues.push({ code: 'invalid_step', fieldKey: field.key });
      }
      continue;
    }

    if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
      issues.push({ code: 'invalid_option', fieldKey: field.key });
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return { success: true, config };
}
