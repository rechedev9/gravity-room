/**
 * Session-frequency insight (aggregate, exercise_id = null).
 *
 * Ports apps/backend/analytics/insights/frequency.py. Computes sessions/week,
 * the current consecutive-day streak, a weekly consistency percentage, and a
 * trailing window of workout dates for heatmap rendering.
 */

import type { WorkoutRecord } from '../record';
import { isoWeekKeyFromTimestamp } from '../iso-week';
import { wallClockDateKey, daysBetweenDateKeys, shiftDateKey } from './time';
import { pyRound } from './round';

export interface FrequencyPayload {
  readonly sessionsPerWeek: number;
  readonly currentStreak: number;
  readonly consistencyPct: number;
  readonly totalSessions: number;
  readonly workoutDates: string[];
}

export function computeFrequency(records: readonly WorkoutRecord[]): FrequencyPayload | null {
  // Collect unique workout dates (one session per calendar date max).
  const dates = new Set<string>();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    const key = wallClockDateKey(r.recordedAt);
    if (key !== null) dates.add(key);
  }

  if (dates.size < 3) return null;

  const sortedDates = [...dates].sort();
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];
  const totalWeeks = Math.max(1, daysBetweenDateKeys(first, last) / 7);

  const sessionsPerWeek = pyRound(sortedDates.length / totalWeeks, 2);
  const streak = currentStreak(sortedDates);
  const consistencyPct = consistencyPercentage(sortedDates, first, last);

  // Include the last 28 days of workout dates for heatmap rendering.
  const workoutDates = sortedDates.length > 28 ? sortedDates.slice(-28) : sortedDates;

  return {
    sessionsPerWeek,
    currentStreak: streak,
    consistencyPct,
    totalSessions: sortedDates.length,
    workoutDates,
  };
}

/** Consecutive calendar days from the most recent session backwards. */
function currentStreak(sortedDateKeys: readonly string[]): number {
  if (sortedDateKeys.length === 0) return 0;
  const present = new Set(sortedDateKeys);
  let streak = 0;
  let cursor = sortedDateKeys[sortedDateKeys.length - 1];
  while (present.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

/** Percentage of elapsed weeks that contain at least one session, capped at
 * 100 and rounded to one decimal, matching frequency.py:_consistency_pct. */
function consistencyPercentage(
  sortedDateKeys: readonly string[],
  first: string,
  last: string
): number {
  const totalWeeks = Math.max(1, Math.floor((daysBetweenDateKeys(first, last) + 1) / 7));

  const weeksWithSession = new Set<string>();
  for (const key of sortedDateKeys) {
    const weekKey = isoWeekKeyFromTimestamp(key);
    if (weekKey !== null) weeksWithSession.add(weekKey);
  }

  return pyRound(Math.min(100, (weeksWithSession.size / totalWeeks) * 100), 1);
}
