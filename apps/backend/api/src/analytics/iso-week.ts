/**
 * ISO week / ISO week-year helpers used to bucket workout sessions, matching
 * how the Python analytics service buckets by week.
 *
 * The Python code does:
 *   dt = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
 *   cal = dt.isocalendar()
 *   week_key = f"{cal.year}-W{cal.week:02d}"
 *
 * Two parity-critical details are reproduced here:
 *   1. `datetime.isocalendar()` on an offset-aware datetime uses that
 *      datetime's OWN wall-clock date (its year/month/day as written), NOT the
 *      UTC instant. So a timestamp "2021-01-01T00:30:00+02:00" buckets by the
 *      calendar date 2021-01-01, regardless of host timezone. We therefore
 *      parse the wall-clock Y/M/D directly from the string and build a local
 *      Date from those fields so date-fns reads the intended calendar date.
 *   2. The key is zero-padded to two week digits: `${weekYear}-W${ww}`.
 */

import { getISOWeek, getISOWeekYear } from 'date-fns';

/** ISO week number (1-53) for the given Date's local calendar fields. */
export function isoWeek(date: Date): number {
  return getISOWeek(date);
}

/** ISO week-numbering year for the given Date's local calendar fields. */
export function isoWeekYear(date: Date): number {
  return getISOWeekYear(date);
}

/** `${isoWeekYear}-W${week}` with the week zero-padded to two digits. */
export function isoWeekKey(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Parse the wall-clock calendar date (year/month/day) of an ISO-8601
 * timestamp, ignoring any timezone offset, and return a local Date at midnight
 * for that calendar date. Returns `null` for unparseable input, mirroring the
 * Python `except ValueError` branches that drop the record.
 */
export function parseWallClockDate(timestamp: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(timestamp);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  // Reject overflow (e.g. month 02 day 31 rolled forward by the Date ctor).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * ISO week key for an ISO-8601 timestamp string, using its wall-clock date.
 * Returns `null` for unparseable input.
 */
export function isoWeekKeyFromTimestamp(timestamp: string): string | null {
  const date = parseWallClockDate(timestamp);
  if (date === null) return null;
  return isoWeekKey(date);
}
