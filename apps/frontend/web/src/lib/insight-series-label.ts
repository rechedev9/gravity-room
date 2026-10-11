import { parseInsightSeriesKey } from '@gzclp/domain/insight-series';

/** Display text for an insight's series key: `squat` or `squat T2` for a lift trained in several tiers. */
export function insightSeriesLabel(key: string): string {
  const { exerciseId, tier } = parseInsightSeriesKey(key);
  return tier === null ? exerciseId : `${exerciseId} ${tier.toUpperCase()}`;
}
