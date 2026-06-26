import { describe, it, expect } from 'bun:test';
import {
  isoWeek,
  isoWeekYear,
  isoWeekKey,
  parseWallClockDate,
  isoWeekKeyFromTimestamp,
} from './iso-week';
import golden from './__fixtures__/golden.json';

// Oracle generated from Python datetime.isocalendar() (see generate_golden.py).

describe('isoWeek / isoWeekYear / isoWeekKey', () => {
  for (const c of golden.isoWeek) {
    it(`${c.date} -> ${c.key}`, () => {
      const date = parseWallClockDate(c.date)!;
      expect(date).not.toBeNull();
      expect(isoWeek(date)).toBe(c.isoWeek);
      expect(isoWeekYear(date)).toBe(c.isoYear);
      expect(isoWeekKey(date)).toBe(c.key);
    });
  }
});

describe('isoWeekKeyFromTimestamp', () => {
  for (const c of golden.isoWeekTs) {
    it(`${c.ts} -> ${c.key} (wall-clock date, ignoring offset)`, () => {
      expect(isoWeekKeyFromTimestamp(c.ts)).toBe(c.key);
    });
  }

  it('returns null for unparseable input', () => {
    expect(isoWeekKeyFromTimestamp('not-a-date')).toBeNull();
    expect(isoWeekKeyFromTimestamp('')).toBeNull();
  });
});

describe('parseWallClockDate', () => {
  it('extracts the wall-clock Y/M/D regardless of offset', () => {
    const d = parseWallClockDate('2021-01-01T00:30:00+02:00')!;
    expect(d.getFullYear()).toBe(2021);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('rejects calendar-overflow dates', () => {
    expect(parseWallClockDate('2021-02-31')).toBeNull();
    expect(parseWallClockDate('2021-13-01')).toBeNull();
  });
});
