import { describe, expect, it } from 'vitest';
import { buildCurrentWeekActivity } from './program-status-card';

describe('buildCurrentWeekActivity', () => {
  it('maps only workouts from the current Monday-to-Sunday week', () => {
    const activity = buildCurrentWeekActivity(
      ['2026-07-12T12:00:00', '2026-07-13T12:00:00', '2026-07-18T12:00:00', 'invalid-date'],
      new Date('2026-07-18T18:00:00')
    );

    expect(activity).toEqual([true, false, false, false, false, true, false]);
  });

  it('deduplicates multiple sessions on the same day for the weekday indicator', () => {
    const activity = buildCurrentWeekActivity(
      ['2026-07-15T08:00:00', '2026-07-15T18:00:00'],
      new Date('2026-07-16T12:00:00')
    );

    expect(activity.filter(Boolean)).toHaveLength(1);
    expect(activity[2]).toBe(true);
  });
});
