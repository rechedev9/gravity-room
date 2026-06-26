import { describe, it, expect } from 'vitest';
import { buildHeatmapGrid, cellLevel } from './week-heatmap-utils';

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
