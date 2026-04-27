/** Shared insight payload interfaces and type guards. */

export interface FrequencyPayload {
  readonly sessionsPerWeek: number;
  readonly currentStreak: number;
  readonly consistencyPct: number;
  readonly totalSessions: number;
  readonly workoutDates?: readonly string[];
}

export function isFrequencyPayload(v: unknown): v is FrequencyPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'sessionsPerWeek' in v &&
    typeof v.sessionsPerWeek === 'number' &&
    'currentStreak' in v &&
    typeof v.currentStreak === 'number' &&
    'consistencyPct' in v &&
    typeof v.consistencyPct === 'number'
  );
}

export interface VolumeTrendPayload {
  readonly weeks: string[];
  readonly volumes: number[];
  readonly slope: number;
  readonly direction: 'up' | 'down' | 'flat';
}

export function isVolumeTrendPayload(v: unknown): v is VolumeTrendPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'weeks' in v &&
    Array.isArray(v.weeks) &&
    'volumes' in v &&
    Array.isArray(v.volumes) &&
    'direction' in v &&
    typeof v.direction === 'string'
  );
}

export interface PlateauPayload {
  readonly isPlateauing: boolean;
  readonly confidence: number;
  readonly slope: number;
  readonly currentWeight: number;
  readonly weeksAnalyzed: number;
}

export function isPlateauPayload(v: unknown): v is PlateauPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'isPlateauing' in v &&
    typeof v.isPlateauing === 'boolean' &&
    'confidence' in v &&
    typeof v.confidence === 'number' &&
    'currentWeight' in v &&
    typeof v.currentWeight === 'number' &&
    'weeksAnalyzed' in v &&
    typeof v.weeksAnalyzed === 'number'
  );
}

export interface RecommendationPayload {
  readonly currentWeight: number;
  readonly recommendedWeight: number;
  readonly shouldIncrement: boolean;
  readonly confidence: number;
  readonly method: 'logistic_regression' | 'consecutive_success';
}

export function isRecommendationPayload(v: unknown): v is RecommendationPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'currentWeight' in v &&
    typeof v.currentWeight === 'number' &&
    'recommendedWeight' in v &&
    typeof v.recommendedWeight === 'number' &&
    'shouldIncrement' in v &&
    typeof v.shouldIncrement === 'boolean' &&
    'confidence' in v &&
    typeof v.confidence === 'number'
  );
}
