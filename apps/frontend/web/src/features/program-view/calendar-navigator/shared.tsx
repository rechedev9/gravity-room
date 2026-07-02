import type { GenericWorkoutRow } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarNavigatorProps {
  /** All workout rows for the program (ordered by index). */
  readonly rows: readonly GenericWorkoutRow[];
  /** 0-based index of the currently selected day. */
  readonly selectedDayIndex: number;
  /** 0-based index of the "current" (next-to-do) day, or -1 if none. */
  readonly currentDayIndex: number;
  /** Number of workouts per week (used for week chunking). */
  readonly workoutsPerWeek: number;
  /**
   * Optional map of workout index → ISO timestamp string for completed days.
   * Keys may be numeric or string representations of the 0-based day index.
   * When provided, days with a timestamp are shown as "completed".
   * Takes lower priority than `completedDayIndices` when both are supplied.
   */
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  /**
   * Optional set of 0-based day indices that are completed.
   * Preferred over `resultTimestamps` for tracker context where completion is
   * derived from `row.slots.every(s => s.result !== undefined)`.
   */
  readonly completedDayIndices?: ReadonlySet<number>;
  /** Whether this is a preview (locks future days) or live tracker. */
  readonly context: 'preview' | 'tracker';
  /** Called when the user selects a day. */
  readonly onSelectDay: (index: number) => void;
}

export type TileState = 'selected' | 'current' | 'completed' | 'pending';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function totalWeeks(totalRows: number, workoutsPerWeek: number): number {
  return Math.ceil(totalRows / workoutsPerWeek);
}

export function weekIndexForDay(dayIndex: number, workoutsPerWeek: number): number {
  return Math.floor(dayIndex / workoutsPerWeek);
}

/** Number of weeks to show per "month page" (4–6). */
export const WEEKS_PER_MONTH_PAGE = 4;

export function resolveTileState(
  rowIndex: number,
  selectedDayIndex: number,
  currentDayIndex: number,
  resultTimestamps: Readonly<Record<string, string>> | undefined,
  completedDayIndices: ReadonlySet<number> | undefined
): TileState {
  if (rowIndex === selectedDayIndex) return 'selected';
  if (rowIndex === currentDayIndex) return 'current';
  // completedDayIndices takes priority over resultTimestamps
  if (completedDayIndices !== undefined) {
    if (completedDayIndices.has(rowIndex)) return 'completed';
  } else if (resultTimestamps?.[String(rowIndex)] !== undefined) {
    return 'completed';
  }
  return 'pending';
}
