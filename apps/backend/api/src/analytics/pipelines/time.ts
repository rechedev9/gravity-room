/**
 * Timestamp helpers shared by the analytics pipelines.
 *
 * Two distinct semantics are reproduced from the Python service, and they are
 * NOT interchangeable:
 *
 *   - INSTANT parsing (`parseInstant`) mirrors
 *     `datetime.fromisoformat(ts.replace("Z", "+00:00"))` and yields a real UTC
 *     instant. Plateau's 8-week cutoff and the recommendation volume/recency
 *     windows compare instants, so they use this.
 *   - WALL-CLOCK parsing (`wallClockDateKey`, plus iso-week.ts) ignores the
 *     offset and uses the timestamp's own calendar Y/M/D, mirroring how
 *     `datetime.isocalendar()` / `datetime.date()` behave on an offset-aware
 *     datetime. Week and day bucketing use this.
 */

import { parseWallClockDate } from '../iso-week';

const MS_PER_DAY = 86_400_000;

/**
 * Parse an ISO-8601 / Postgres `timestamptz::text` string into a UTC instant,
 * mirroring Python `datetime.fromisoformat(ts.replace("Z", "+00:00"))`.
 *
 * Accepts both the `T` separator and the space separator Postgres emits, and
 * pads a bare two-digit offset (`+00`) to `+00:00`. Returns null when the
 * string cannot be parsed, mirroring the Python `except ValueError` branches
 * that drop the record.
 */
export function parseInstant(timestamp: string): Date | null {
  let s = timestamp.trim();
  if (!s.includes('T') && s.includes(' ')) {
    s = s.replace(' ', 'T');
  }
  s = s.replace('Z', '+00:00');
  // Pad a trailing bare-hour offset like "+00" / "-05" to "+00:00" / "-05:00".
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Wall-clock calendar-date key `YYYY-MM-DD`, mirroring Python
 * `datetime.fromisoformat(...).date().isoformat()`. Returns null on parse
 * failure (matching the Python `except ValueError: pass` drop).
 */
export function wallClockDateKey(timestamp: string): string | null {
  const date = parseWallClockDate(timestamp);
  if (date === null) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole-day difference `(b - a)` between two `YYYY-MM-DD` keys, matching the
 * `.days` field of a Python `date - date` timedelta. */
export function daysBetweenDateKeys(a: string, b: string): number {
  return Math.round((midnightUtc(b) - midnightUtc(a)) / MS_PER_DAY);
}

/** Shift a `YYYY-MM-DD` key by a whole number of days, returning a new key. */
export function shiftDateKey(key: string, deltaDays: number): string {
  const shifted = new Date(midnightUtc(key) + deltaDays * MS_PER_DAY);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function midnightUtc(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}
