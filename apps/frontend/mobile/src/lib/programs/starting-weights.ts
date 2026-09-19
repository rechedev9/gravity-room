import type { ProgramDefinition } from '@gzclp/domain';

/** Upper bound accepted by the API for a program config weight (`programConfigSchema`). */
export const MAX_STARTING_WEIGHT = 10_000;

// Legacy default kept for programs whose minimum is zero: eight steps, else an empty bar.
const DEFAULT_WEIGHT_MULTIPLIER = 8;
const DEFAULT_WEIGHT_FALLBACK = 20;

export interface StartingWeightField {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly step: number;
  readonly hint?: string;
  readonly group?: string;
  /** Value shown before the lifter edits anything; same rule as the legacy default config. */
  readonly defaultValue: number;
}

export type StartingWeightIssue = 'required' | 'invalid' | 'below_min' | 'above_max';

export type StartingWeightsValidation =
  | { readonly ok: true; readonly weights: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly issues: Readonly<Record<string, StartingWeightIssue>> };

type WeightField = Extract<ProgramDefinition['configFields'][number], { type: 'weight' }>;

function defaultWeight(field: WeightField): number {
  return field.min > 0
    ? field.min
    : field.step * DEFAULT_WEIGHT_MULTIPLIER || DEFAULT_WEIGHT_FALLBACK;
}

/** Weight config fields of a definition, in catalog order, with their default value. */
export function startingWeightFields(
  definition: ProgramDefinition
): readonly StartingWeightField[] {
  return definition.configFields.flatMap((field) => {
    if (field.type !== 'weight') return [];
    return [
      {
        key: field.key,
        label: field.label,
        min: field.min,
        step: field.step,
        ...(field.hint !== undefined ? { hint: field.hint } : {}),
        ...(field.group !== undefined ? { group: field.group } : {}),
        defaultValue: defaultWeight(field),
      },
    ];
  });
}

/** Parses lifter input (`"32,5"`, `" 60 "`) into a finite number, or null. */
export function parseStartingWeight(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/u.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Validates one text value per field; every field must be present and within bounds. */
export function validateStartingWeights(
  fields: readonly StartingWeightField[],
  values: Readonly<Record<string, string>>
): StartingWeightsValidation {
  const weights: Record<string, number> = {};
  const issues: Record<string, StartingWeightIssue> = {};
  for (const field of fields) {
    const text = values[field.key] ?? '';
    if (text.trim() === '') {
      issues[field.key] = 'required';
      continue;
    }
    const value = parseStartingWeight(text);
    if (value === null) issues[field.key] = 'invalid';
    else if (value < Math.max(field.min, 0)) issues[field.key] = 'below_min';
    else if (value > MAX_STARTING_WEIGHT) issues[field.key] = 'above_max';
    else weights[field.key] = value;
  }
  return Object.keys(issues).length > 0 ? { ok: false, issues } : { ok: true, weights };
}

/** Default config with the lifter's weights applied to the weight fields only. */
export function buildProgramConfig(
  definition: ProgramDefinition,
  weights: Readonly<Record<string, number>>
): Record<string, number | string> {
  const config: Record<string, number | string> = {};
  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      config[field.key] = weights[field.key] ?? defaultWeight(field);
      continue;
    }
    const firstOption = field.options[0];
    if (!firstOption) throw new Error(`Missing options for ${field.key}`);
    config[field.key] = firstOption.value;
  }
  return config;
}
