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

export interface E1rmPayload {
  readonly dates: string[];
  readonly e1rms: number[];
  readonly currentMax: number;
}

export function isE1rmPayload(v: unknown): v is E1rmPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'dates' in v &&
    Array.isArray(v.dates) &&
    'e1rms' in v &&
    Array.isArray(v.e1rms) &&
    'currentMax' in v &&
    typeof v.currentMax === 'number'
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

export interface ExerciseSummaryPayload {
  readonly totalSets: number;
  readonly successSets: number;
  readonly successRate: number;
  readonly totalVolume: number;
  readonly avgRpe: number | null;
}

export function isExerciseSummaryPayload(v: unknown): v is ExerciseSummaryPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'totalSets' in v &&
    typeof v.totalSets === 'number' &&
    'successSets' in v &&
    typeof v.successSets === 'number' &&
    'successRate' in v &&
    typeof v.successRate === 'number' &&
    'totalVolume' in v &&
    typeof v.totalVolume === 'number'
  );
}

export interface ForecastPayload {
  readonly weeks: string[];
  readonly e1rms: number[];
  readonly slope: number;
  readonly rSquared: number;
  readonly forecast2w: number;
  readonly forecast4w: number;
  readonly band2w: number;
  readonly band4w: number;
}

export function isForecastPayload(v: unknown): v is ForecastPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'weeks' in v &&
    Array.isArray(v.weeks) &&
    'e1rms' in v &&
    Array.isArray(v.e1rms) &&
    'forecast2w' in v &&
    typeof v.forecast2w === 'number' &&
    'forecast4w' in v &&
    typeof v.forecast4w === 'number'
  );
}
