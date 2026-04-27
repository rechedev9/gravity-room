import { err, ok, type Result } from './result';

export const INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'plateau_detection',
  'load_recommendation',
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

export interface InvalidInsightTypesError {
  readonly invalidValues: readonly string[];
}

const KNOWN: ReadonlySet<string> = new Set<string>(INSIGHT_TYPES);

function isKnown(value: string): value is InsightType {
  return KNOWN.has(value);
}

export function parseInsightTypesQuery(
  raw: string | undefined
): Result<readonly InsightType[], InvalidInsightTypesError> {
  if (raw === undefined || raw === '') return ok([]);

  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const invalidValues: string[] = [];
  const validValues: InsightType[] = [];
  for (const entry of entries) {
    if (isKnown(entry)) validValues.push(entry);
    else invalidValues.push(entry);
  }

  if (invalidValues.length > 0) return err({ invalidValues });
  return ok(validValues);
}
