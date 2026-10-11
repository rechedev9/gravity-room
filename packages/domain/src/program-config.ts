import type { ProgramDefinition } from './schemas/program-definition';

export type ProgramConfigField = ProgramDefinition['configFields'][number];
export type ProgramConfigValues = Record<string, number | string>;

const DEFAULT_WEIGHT_STEPS = 8;
const DEFAULT_WEIGHT_FALLBACK = 20;

export type WeightConfigField = Extract<ProgramConfigField, { type: 'weight' }>;

/** Starting weight of a weight field: its `min` when it has one, else `step * 8` (20 kg without a step). */
export function defaultWeightValue(field: WeightConfigField): number {
  if (field.min > 0) return field.min;
  return field.step * DEFAULT_WEIGHT_STEPS || DEFAULT_WEIGHT_FALLBACK;
}

/** Value a field starts with before the lifter edits it: a select takes its first option. */
export function defaultConfigValue(field: ProgramConfigField): number | string {
  if (field.type === 'weight') return defaultWeightValue(field);
  const firstOption = field.options[0];
  if (!firstOption) throw new Error(`Missing options for ${field.key}`);
  return firstOption.value;
}

/** Default config of a definition; `weightOverrides` replace weight fields only. */
export function buildProgramConfig(
  definition: Pick<ProgramDefinition, 'configFields'>,
  weightOverrides: Readonly<Record<string, number>> = {}
): ProgramConfigValues {
  const config: ProgramConfigValues = {};
  for (const field of definition.configFields) {
    const override = field.type === 'weight' ? weightOverrides[field.key] : undefined;
    config[field.key] = override ?? defaultConfigValue(field);
  }
  return config;
}
