import { describe, it, expect } from 'vitest';
import {
  buildHeatmapGrid,
  buildMonthLabels,
  buildWeekdayLabels,
  cellLevel,
} from './week-heatmap-utils';

describe('buildHeatmapGrid', () => {
  it('returns 12 columns × 7 rows', () => {
    const grid = buildHeatmapGrid([], new Date('2026-05-11'));
    expect(grid).toHaveLength(12);
    grid.forEach((col) => expect(col).toHaveLength(7));
  });

  it('marks a workout day with level=full when 2+ workouts that day', () => {
    const today = new Date('2026-05-11T12:00:00Z'); // Monday
    const grid = buildHeatmapGrid(
      [{ completedAt: '2026-05-11T08:00:00Z' }, { completedAt: '2026-05-11T18:00:00Z' }],
      today
    );
    const lastCol = grid[11]!;
    expect(lastCol[0]?.level).toBe('full');
  });
});

describe('buildMonthLabels', () => {
  it('labels only the first column of each month, localized', () => {
    // 12 weeks ending mid-May 2026 spans Feb→May.
    const grid = buildHeatmapGrid([], new Date('2026-05-11T12:00:00Z'), 12);
    const labels = buildMonthLabels(grid, 'es');
    // One label per distinct month present; the rest are null.
    const nonNull = labels.filter((l): l is string => l !== null);
    expect(nonNull.length).toBeGreaterThanOrEqual(3);
    expect(labels).toHaveLength(12);
    // A new-month column carries a string; interior weeks of a month are null.
    expect(nonNull.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
  });
});

describe('buildWeekdayLabels', () => {
  it('returns 7 Monday-first localized short names', () => {
    const es = buildWeekdayLabels('es');
    expect(es).toHaveLength(7);
    // Index 0 is Monday in both locales.
    expect(es[0]?.toLowerCase()).toContain('lun');
    const en = buildWeekdayLabels('en');
    expect(en[0]?.toLowerCase()).toContain('mon');
  });
});

describe('cellLevel', () => {
  it('returns empty when 0 workouts', () => {
    expect(cellLevel(0)).toBe('empty');
  });
  it('returns partial when 1 workout', () => {
    expect(cellLevel(1)).toBe('partial');
  });
  it('returns full when 2+ workouts', () => {
    expect(cellLevel(2)).toBe('full');
  });
});
