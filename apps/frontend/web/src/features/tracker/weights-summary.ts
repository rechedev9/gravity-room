import type { ProgramDefinition } from '@gzclp/domain/types/program';

/** Build a compact summary string: "Squat 80 · Bench 55 · +2 more" */
export function buildWeightsSummary(
  config: Record<string, number | string>,
  fields: ProgramDefinition['configFields'],
  overflowLabel: (n: number) => string,
  localizeLabel: (key: string, fallback: string) => string = (_k, f) => f,
  limit = 4
): string {
  const weightFields = fields.filter((f) => f.type === 'weight');
  const shown = weightFields.slice(0, limit);
  const overflow = weightFields.length - limit;
  const parts = shown.map((f) => {
    const label = localizeLabel(f.key, f.label);
    const val = config[f.key];
    return val !== undefined ? `${label} ${val}` : label;
  });
  if (overflow > 0) parts.push(overflowLabel(overflow));
  return parts.join(' · ');
}
