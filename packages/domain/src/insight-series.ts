/**
 * Identity of one analytics series. A lift trained in several tiers (T1 and T2
 * of the same squat) carries a different load in each, so the series is the
 * lift in one tier, mirroring how the engine keys a lift's previous weight.
 * The key is stored in `user_insights.exercise_id`: the bare exercise id when
 * the user only ever trained that lift in one tier, `exerciseId:tier` otherwise.
 */
const SEPARATOR = ':';
const MAX_KEY_LENGTH = 100;

export interface InsightSeriesRef {
  readonly exerciseId: string;
  readonly tier: string | null;
}

/** Throws a RangeError for a key the column cannot hold or `parse` cannot read back. */
export function buildInsightSeriesKey({ exerciseId, tier }: InsightSeriesRef): string {
  if (exerciseId.includes(SEPARATOR)) {
    throw new RangeError(`Insight series exercise id contains "${SEPARATOR}": ${exerciseId}`);
  }
  const key =
    tier === null ? exerciseId : `${exerciseId}${SEPARATOR}${tier.replaceAll(SEPARATOR, '-')}`;
  // Cutting the key would merge the tiers of one lift into a single series.
  if (key.length > MAX_KEY_LENGTH) {
    throw new RangeError(`Insight series key exceeds ${MAX_KEY_LENGTH} characters: ${key}`);
  }
  return key;
}

export function parseInsightSeriesKey(key: string): InsightSeriesRef {
  const at = key.indexOf(SEPARATOR);
  if (at < 0) return { exerciseId: key, tier: null };
  return { exerciseId: key.slice(0, at), tier: key.slice(at + 1) };
}
