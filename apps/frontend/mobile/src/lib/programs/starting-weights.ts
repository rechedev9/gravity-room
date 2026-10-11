import {
  MAX_PROGRAM_CONFIG_WEIGHT,
  defaultConfigValue,
  defaultWeightValue,
  type ProgramDefinition,
} from '@gzclp/domain';

export interface StartingWeightField {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly step: number;
  readonly hint?: string;
  readonly group?: string;
  readonly groupHint?: string;
  /** Value shown before the lifter edits anything; from the domain default-config rule. */
  readonly defaultValue: number;
}

/** A select config field, such as a rounding step or the lifter's gender. */
export interface StartingChoiceField {
  readonly key: string;
  readonly label: string;
  readonly group?: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly defaultValue: string;
}

export type StartingWeightIssue = 'required' | 'invalid' | 'below_min' | 'above_max';

export type StartingWeightsValidation =
  | { readonly ok: true; readonly weights: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly issues: Readonly<Record<string, StartingWeightIssue>> };

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
        ...(field.groupHint !== undefined ? { groupHint: field.groupHint } : {}),
        defaultValue: defaultWeightValue(field),
      },
    ];
  });
}

/** Select config fields of a definition, in catalog order, with their default option. */
export function startingChoiceFields(
  definition: ProgramDefinition
): readonly StartingChoiceField[] {
  return definition.configFields.flatMap((field) => {
    if (field.type !== 'select') return [];
    return [
      {
        key: field.key,
        label: field.label,
        ...(field.group !== undefined ? { group: field.group } : {}),
        options: field.options,
        defaultValue: String(defaultConfigValue(field)),
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
    else if (value > MAX_PROGRAM_CONFIG_WEIGHT) issues[field.key] = 'above_max';
    else weights[field.key] = value;
  }
  return Object.keys(issues).length > 0 ? { ok: false, issues } : { ok: true, weights };
}
