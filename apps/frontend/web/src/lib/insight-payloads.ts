/** Shared insight payload interfaces and type guards. */

export interface FrequencyPayload {
  readonly sessionsPerWeek: number;
  readonly currentStreak: number;
  readonly consistencyPct: number;
  readonly totalSessions: number;
  readonly workoutDates?: readonly string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

export function isFrequencyPayload(v: unknown): v is FrequencyPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'sessionsPerWeek' in v &&
    isFiniteNumber(v.sessionsPerWeek) &&
    'currentStreak' in v &&
    isFiniteNumber(v.currentStreak) &&
    'consistencyPct' in v &&
    isFiniteNumber(v.consistencyPct) &&
    'totalSessions' in v &&
    isFiniteNumber(v.totalSessions) &&
    (!('workoutDates' in v) || v.workoutDates === undefined || isStringArray(v.workoutDates))
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
  if (!('weeks' in v) || !isStringArray(v.weeks)) return false;
  if (!('volumes' in v) || !isFiniteNumberArray(v.volumes)) return false;
  return (
    v.weeks.length === v.volumes.length &&
    'slope' in v &&
    isFiniteNumber(v.slope) &&
    'direction' in v &&
    (v.direction === 'up' || v.direction === 'down' || v.direction === 'flat')
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
    isFiniteNumber(v.confidence) &&
    v.confidence >= 0 &&
    v.confidence <= 1 &&
    'slope' in v &&
    isFiniteNumber(v.slope) &&
    'currentWeight' in v &&
    isFiniteNumber(v.currentWeight) &&
    'weeksAnalyzed' in v &&
    isFiniteNumber(v.weeksAnalyzed)
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
    isFiniteNumber(v.currentWeight) &&
    'recommendedWeight' in v &&
    isFiniteNumber(v.recommendedWeight) &&
    'shouldIncrement' in v &&
    typeof v.shouldIncrement === 'boolean' &&
    'confidence' in v &&
    isFiniteNumber(v.confidence) &&
    v.confidence >= 0 &&
    v.confidence <= 1 &&
    'method' in v &&
    (v.method === 'logistic_regression' || v.method === 'consecutive_success')
  );
}
