export type CellLevel = 'empty' | 'partial' | 'full';

export interface HeatmapCell {
  readonly date: Date;
  readonly level: CellLevel;
  readonly count: number;
}

export interface CompletedWorkout {
  readonly completedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function cellLevel(count: number): CellLevel {
  if (count === 0) return 'empty';
  if (count === 1) return 'partial';
  return 'full';
}

export function buildHeatmapGrid(
  workouts: readonly CompletedWorkout[],
  today: Date,
  weeks = 12
): HeatmapCell[][] {
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  // Find Monday of today's week (locale-independent: getDay 0=Sun, so (dow+6)%7 → Mon=0)
  const dow = (end.getDay() + 6) % 7;
  const mondayOfThisWeek = new Date(end.getTime() - dow * DAY_MS);
  const start = new Date(mondayOfThisWeek.getTime() - (weeks - 1) * 7 * DAY_MS);

  const counts = new Map<string, number>();
  for (const w of workouts) {
    const d = new Date(w.completedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const columns: HeatmapCell[][] = [];
  for (let c = 0; c < weeks; c++) {
    const col: HeatmapCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = new Date(start.getTime() + (c * 7 + r) * DAY_MS);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const count = counts.get(key) ?? 0;
      col.push({ date, count, level: cellLevel(count) });
    }
    columns.push(col);
  }
  return columns;
}

/**
 * One entry per week column: the localized short month name when that column is
 * the first of a new month (GitHub-style), otherwise null. Anchored on the
 * Monday of each column so a label sits above the week where the month starts.
 */
export function buildMonthLabels(grid: HeatmapCell[][], locale: string): (string | null)[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const labels: (string | null)[] = [];
  let prevMonth = -1;
  for (const col of grid) {
    const first = col[0];
    if (!first) {
      labels.push(null);
      continue;
    }
    const month = first.date.getMonth();
    if (month !== prevMonth) {
      labels.push(fmt.format(first.date));
      prevMonth = month;
    } else {
      labels.push(null);
    }
  }
  return labels;
}

// A known Monday (2024-01-01) so weekday index 0 = Monday, matching the grid's
// Monday-first rows regardless of the locale's own first-day-of-week.
const REFERENCE_MONDAY = new Date(2024, 0, 1);

/** Localized short weekday names, Monday→Sunday (index 0 = Monday). */
export function buildWeekdayLabels(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    labels.push(fmt.format(new Date(REFERENCE_MONDAY.getTime() + i * DAY_MS)));
  }
  return labels;
}
