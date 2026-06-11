import { useState, useId, useEffect } from 'react';
import type { ReactNode, FormEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { loadNavMode, saveNavMode } from './program-navigation-preference';
import type { NavMode } from './program-navigation-preference';
import { trackEvent } from '@/lib/analytics';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function totalWeeks(totalRows: number, workoutsPerWeek: number): number {
  return Math.ceil(totalRows / workoutsPerWeek);
}

function weekIndexForDay(dayIndex: number, workoutsPerWeek: number): number {
  return Math.floor(dayIndex / workoutsPerWeek);
}

/** Number of weeks to show per "month page" (4–6). */
const WEEKS_PER_MONTH_PAGE = 4;

// ---------------------------------------------------------------------------
// DayTile
// ---------------------------------------------------------------------------

type TileState = 'selected' | 'current' | 'completed' | 'pending';

function resolveTileState(
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

const TILE_STATE_CLASSES: Record<TileState, string> = {
  selected: 'bg-accent text-bg border-2 border-accent font-bold',
  current: 'bg-card border-2 border-accent text-accent font-bold',
  completed: 'bg-card border border-rule text-muted opacity-70',
  pending: 'bg-card border border-rule text-main hover:border-rule-light hover:bg-hover-row',
};

interface DayTileProps {
  row: GenericWorkoutRow;
  state: TileState;
  onSelect: () => void;
}

function DayTile({ row, state, onSelect }: DayTileProps): ReactNode {
  const { t } = useTranslation();
  const label = t('calendar_navigator.day_tile_aria', {
    index: row.index + 1,
    state: t(`calendar_navigator.tile_state.${state}`),
  });

  return (
    <button
      type="button"
      data-testid="day-tile"
      onClick={onSelect}
      aria-label={label}
      aria-current={state === 'selected' ? 'true' : undefined}
      className={`
        flex flex-col items-center justify-center
        min-h-[44px] min-w-[44px] px-2 py-1.5
        text-xs font-mono tabular-nums
        transition-all duration-150 active:scale-95
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${TILE_STATE_CLASSES[state]}
      `}
    >
      <span className="text-sm font-bold leading-none">{row.index + 1}</span>
      {state === 'completed' && (
        <span className="text-2xs mt-0.5 text-accent" aria-hidden="true">
          ●
        </span>
      )}
      {state === 'current' && (
        <span className="text-2xs mt-0.5 text-accent" aria-hidden="true">
          ▶
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// NavModeSelector — segmented Día | Semana | Mes
// ---------------------------------------------------------------------------

const NAV_MODES: NavMode[] = ['day', 'week', 'month'];

interface NavModeSelectorProps {
  mode: NavMode;
  onChange: (mode: NavMode) => void;
}

function NavModeSelector({ mode, onChange }: NavModeSelectorProps): ReactNode {
  const { t } = useTranslation();
  return (
    <fieldset className="contents">
      <legend className="sr-only">{t('calendar_navigator.nav_mode_group_aria')}</legend>
      <div className="flex border border-rule overflow-hidden self-start">
        {NAV_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`
              text-xs font-semibold px-3 py-1.5 min-h-[44px]
              transition-all duration-150 active:scale-95
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
              ${
                mode === m
                  ? 'bg-accent text-bg'
                  : 'bg-card text-muted hover:bg-hover-row hover:text-main'
              }
            `}
          >
            {t(`calendar_navigator.nav_mode.${m}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// DayView — jump form + compact summary of selected day
// ---------------------------------------------------------------------------

interface DayViewProps {
  rows: readonly GenericWorkoutRow[];
  selectedDayIndex: number;
  currentDayIndex: number;
  resultTimestamps: Readonly<Record<string, string>> | undefined;
  completedDayIndices: ReadonlySet<number> | undefined;
  context: 'preview' | 'tracker';
  onSelectDay: (index: number) => void;
}

function DayView({
  rows,
  selectedDayIndex,
  currentDayIndex,
  resultTimestamps,
  completedDayIndices,
  context,
  onSelectDay,
}: DayViewProps): ReactNode {
  const { t } = useTranslation();
  const jumpInputId = useId();
  const jumpLabelId = useId();
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState(false);

  function handleJump(e?: FormEvent): void {
    e?.preventDefault();
    const parsed = parseInt(jumpValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > rows.length) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    setJumpValue('');
    trackEvent('program_navigation_jump', { context });
    onSelectDay(parsed - 1);
  }

  function handleJumpKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleJump();
  }

  const selectedRow = rows[clamp(selectedDayIndex, 0, rows.length - 1)];
  const state = selectedRow
    ? resolveTileState(
        selectedRow.index,
        selectedDayIndex,
        currentDayIndex,
        resultTimestamps,
        completedDayIndices
      )
    : 'pending';

  return (
    <div className="flex flex-col gap-4">
      {/* Jump form */}
      <form
        onSubmit={handleJump}
        className="flex items-center gap-2"
        aria-label={t('calendar_navigator.jump_form_aria')}
      >
        <label
          id={jumpLabelId}
          htmlFor={jumpInputId}
          className="text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
        >
          {t('calendar_navigator.jump_label')}
        </label>
        <input
          id={jumpInputId}
          type="number"
          min={1}
          max={rows.length}
          value={jumpValue}
          onChange={(e) => {
            setJumpValue(e.target.value);
            setJumpError(false);
          }}
          onKeyDown={handleJumpKeyDown}
          aria-labelledby={jumpLabelId}
          aria-invalid={jumpError}
          aria-describedby={jumpError ? `${jumpInputId}-error` : undefined}
          placeholder={`1–${rows.length}`}
          className={`
            w-20 px-2 py-1.5 text-xs font-mono tabular-nums
            border bg-card text-main
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
            ${jumpError ? 'border-red-500' : 'border-rule'}
          `}
        />
        <button
          type="submit"
          aria-label={t('calendar_navigator.jump_button_aria')}
          className="
            text-xs font-bold px-3 py-1.5 min-h-[44px]
            border-2 border-rule bg-card text-muted
            hover:bg-hover-row hover:text-main hover:border-rule-light
            active:scale-95 cursor-pointer transition-all duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
          "
        >
          {t('calendar_navigator.jump_button')}
        </button>
        {jumpError && (
          <span id={`${jumpInputId}-error`} role="alert" className="text-xs text-red-500">
            {t('calendar_navigator.jump_error', { max: rows.length })}
          </span>
        )}
      </form>

      {/* Compact summary of selected day */}
      {selectedRow && (
        <section
          aria-label={t('calendar_navigator.day_summary_aria', {
            index: selectedRow.index + 1,
          })}
          className="flex items-center gap-3 px-3 py-2 border border-rule bg-card"
        >
          <span className="text-sm font-bold font-mono tabular-nums text-accent">
            #{selectedRow.index + 1}
          </span>
          <span className="text-xs text-muted">{selectedRow.dayName}</span>
          <span
            className={`ml-auto text-xs font-semibold ${
              state === 'completed'
                ? 'text-accent'
                : state === 'current'
                  ? 'text-accent'
                  : 'text-muted'
            }`}
          >
            {t(`calendar_navigator.tile_state.${state}`)}
          </span>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeekView — week chips + active week grid (original behaviour)
// ---------------------------------------------------------------------------

interface WeekViewProps {
  rows: readonly GenericWorkoutRow[];
  selectedDayIndex: number;
  currentDayIndex: number;
  workoutsPerWeek: number;
  resultTimestamps: Readonly<Record<string, string>> | undefined;
  completedDayIndices: ReadonlySet<number> | undefined;
  onSelectDay: (index: number) => void;
}

function WeekView({
  rows,
  selectedDayIndex,
  currentDayIndex,
  workoutsPerWeek,
  resultTimestamps,
  completedDayIndices,
  onSelectDay,
}: WeekViewProps): ReactNode {
  const { t } = useTranslation();
  const safeWpw = Math.max(1, workoutsPerWeek);
  const numWeeks = totalWeeks(rows.length, safeWpw);
  const activeWeek = weekIndexForDay(clamp(selectedDayIndex, 0, rows.length - 1), safeWpw);
  const weekChips = Array.from({ length: numWeeks }, (_, i) => i);
  const weekStart = activeWeek * safeWpw;
  const weekRows = rows.slice(weekStart, weekStart + safeWpw);

  return (
    <div className="flex flex-col gap-4">
      {/* Week chips */}
      <div
        role="tablist"
        aria-label={t('calendar_navigator.week_chips_aria')}
        className="flex flex-wrap gap-1.5"
      >
        {weekChips.map((weekIdx) => {
          const isActive = weekIdx === activeWeek;
          const firstDayOfWeek = weekIdx * safeWpw + 1;
          const lastDayOfWeek = Math.min((weekIdx + 1) * safeWpw, rows.length);
          return (
            <button
              key={weekIdx}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={t('calendar_navigator.week_chip_aria', {
                week: weekIdx + 1,
                from: firstDayOfWeek,
                to: lastDayOfWeek,
              })}
              onClick={() => {
                const targetDay = weekIdx * safeWpw;
                onSelectDay(clamp(targetDay, 0, rows.length - 1));
              }}
              className={`
                text-xs font-bold px-3 py-1.5 min-h-[44px]
                border transition-all duration-150 active:scale-95
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
                ${
                  isActive
                    ? 'border-accent bg-accent text-bg'
                    : 'border-rule bg-card text-muted hover:bg-hover-row hover:text-main hover:border-rule-light'
                }
              `}
            >
              {t('calendar_navigator.week_chip_label', { week: weekIdx + 1 })}
            </button>
          );
        })}
      </div>

      {/* Week grid */}
      <div className="flex flex-wrap gap-2">
        {weekRows.map((row) => {
          const state = resolveTileState(
            row.index,
            selectedDayIndex,
            currentDayIndex,
            resultTimestamps,
            completedDayIndices
          );
          return (
            <DayTile
              key={row.index}
              row={row}
              state={state}
              onSelect={() => onSelectDay(row.index)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthTile — compact tile for month view with dayName abbreviation + icon
// ---------------------------------------------------------------------------

/** Truncate dayName to at most `maxLen` chars for compact display. */
function abbreviateDayName(dayName: string, maxLen = 6): string {
  if (dayName.length <= maxLen) return dayName;
  return dayName.slice(0, maxLen - 1) + '…';
}

const MONTH_TILE_STATE_CLASSES: Record<TileState, string> = {
  selected: 'bg-accent text-bg border-2 border-accent font-bold',
  current: 'bg-card border-2 border-accent text-accent font-bold',
  completed: 'bg-card border border-rule text-muted opacity-70',
  pending: 'bg-card border border-rule text-main hover:border-rule-light hover:bg-hover-row',
};

const STATE_ICON: Record<TileState, string | null> = {
  selected: null,
  current: '▶',
  completed: '●',
  pending: null,
};

interface MonthTileProps {
  row: GenericWorkoutRow;
  state: TileState;
  onSelect: () => void;
}

function MonthTile({ row, state, onSelect }: MonthTileProps): ReactNode {
  const { t } = useTranslation();
  const icon = STATE_ICON[state];
  // Full accessible label includes workout number, full dayName, and state
  const label = t('calendar_navigator.day_tile_aria', {
    index: row.index + 1,
    state: t(`calendar_navigator.tile_state.${state}`),
  });
  const abbrev = abbreviateDayName(row.dayName ?? '');

  return (
    <button
      type="button"
      data-testid="day-tile"
      onClick={onSelect}
      aria-label={label}
      title={`#${row.index + 1} ${row.dayName}`}
      aria-current={state === 'selected' ? 'true' : undefined}
      className={`
        flex flex-col items-center justify-center gap-0.5
        min-h-[44px] min-w-[44px] w-full px-1 py-1.5
        text-xs font-mono tabular-nums
        transition-all duration-150 active:scale-95
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${MONTH_TILE_STATE_CLASSES[state]}
      `}
    >
      {/* Workout number */}
      <span className="text-sm font-bold leading-none">{row.index + 1}</span>
      {/* Abbreviated day name */}
      {abbrev && (
        <span className="text-2xs leading-none truncate max-w-full px-0.5" aria-hidden="true">
          {abbrev}
        </span>
      )}
      {/* State icon */}
      {icon && (
        <span className="text-2xs leading-none text-accent" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MonthView — 4–6 program weeks per page
// ---------------------------------------------------------------------------

interface MonthViewProps {
  rows: readonly GenericWorkoutRow[];
  selectedDayIndex: number;
  currentDayIndex: number;
  workoutsPerWeek: number;
  resultTimestamps: Readonly<Record<string, string>> | undefined;
  completedDayIndices: ReadonlySet<number> | undefined;
  onSelectDay: (index: number) => void;
}

function MonthView({
  rows,
  selectedDayIndex,
  currentDayIndex,
  workoutsPerWeek,
  resultTimestamps,
  completedDayIndices,
  onSelectDay,
}: MonthViewProps): ReactNode {
  const { t } = useTranslation();
  const safeWpw = Math.max(1, workoutsPerWeek);
  const numWeeks = totalWeeks(rows.length, safeWpw);
  const activeWeek = weekIndexForDay(clamp(selectedDayIndex, 0, rows.length - 1), safeWpw);

  // Derive the current month page from the active week
  const totalMonthPages = Math.ceil(numWeeks / WEEKS_PER_MONTH_PAGE);
  const activeMonthPage = Math.floor(activeWeek / WEEKS_PER_MONTH_PAGE);
  const [monthPage, setMonthPage] = useState(activeMonthPage);

  // Keep page in sync when selectedDayIndex changes externally
  useEffect(() => {
    setMonthPage(Math.floor(activeWeek / WEEKS_PER_MONTH_PAGE));
  }, [activeWeek]);

  // "Current" month page: the page that contains currentDayIndex (or selectedDayIndex)
  const currentWeek =
    currentDayIndex >= 0
      ? weekIndexForDay(clamp(currentDayIndex, 0, rows.length - 1), safeWpw)
      : activeWeek;
  const currentMonthPage = Math.floor(currentWeek / WEEKS_PER_MONTH_PAGE);
  const isOnCurrentPage = monthPage === currentMonthPage;

  const pageStartWeek = monthPage * WEEKS_PER_MONTH_PAGE;
  const pageEndWeek = Math.min(pageStartWeek + WEEKS_PER_MONTH_PAGE, numWeeks);
  const weeksOnPage = Array.from(
    { length: pageEndWeek - pageStartWeek },
    (_, i) => pageStartWeek + i
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Month page navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={monthPage === 0}
          onClick={() => setMonthPage((p) => Math.max(0, p - 1))}
          aria-label={t('calendar_navigator.month_prev_aria')}
          className="
            text-xs font-bold px-3 py-1.5 min-h-[44px]
            border border-rule bg-card text-muted
            hover:bg-hover-row hover:text-main hover:border-rule-light
            active:scale-95 transition-all duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          "
        >
          ←
        </button>
        <span className="text-xs font-semibold text-muted flex-1 text-center">
          {t('calendar_navigator.month_page_label', {
            page: monthPage + 1,
            total: totalMonthPages,
          })}
        </span>
        {/* "Actual" / Current button — jumps to the page containing currentDayIndex */}
        {!isOnCurrentPage && (
          <button
            type="button"
            onClick={() => setMonthPage(currentMonthPage)}
            aria-label={t('calendar_navigator.month_current_aria')}
            data-testid="month-current-btn"
            className="
              text-xs font-bold px-3 py-1.5 min-h-[44px]
              border border-accent bg-card text-accent
              hover:bg-accent hover:text-bg
              active:scale-95 transition-all duration-150
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
            "
          >
            {t('calendar_navigator.month_current_label')}
          </button>
        )}
        <button
          type="button"
          disabled={monthPage >= totalMonthPages - 1}
          onClick={() => setMonthPage((p) => Math.min(totalMonthPages - 1, p + 1))}
          aria-label={t('calendar_navigator.month_next_aria')}
          className="
            text-xs font-bold px-3 py-1.5 min-h-[44px]
            border border-rule bg-card text-muted
            hover:bg-hover-row hover:text-main hover:border-rule-light
            active:scale-95 transition-all duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          "
        >
          →
        </button>
      </div>

      {/* Weeks grid — responsive: weekly rows with grid columns per week */}
      <div className="flex flex-col gap-3">
        {weeksOnPage.map((weekIdx) => {
          const weekStart = weekIdx * safeWpw;
          const weekRows = rows.slice(weekStart, weekStart + safeWpw);
          const isActiveWeek = weekIdx === activeWeek;
          return (
            <div key={weekIdx} className="flex flex-col gap-1.5">
              <span
                className={`text-2xs font-semibold uppercase tracking-wide ${
                  isActiveWeek ? 'text-accent' : 'text-muted'
                }`}
              >
                {t('calendar_navigator.week_chip_label', { week: weekIdx + 1 })}
              </span>
              {/*
                Responsive grid:
                - Mobile: 2–4 columns depending on workoutsPerWeek (grid-cols-2 up to grid-cols-4)
                - Desktop (sm+): show all workouts per week in one row (up to 7)
                We use CSS grid with auto-fill so tiles expand to fill space.
              */}
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(safeWpw, 7)}, minmax(44px, 1fr))`,
                }}
              >
                {weekRows.map((row) => {
                  const state = resolveTileState(
                    row.index,
                    selectedDayIndex,
                    currentDayIndex,
                    resultTimestamps,
                    completedDayIndices
                  );
                  return (
                    <MonthTile
                      key={row.index}
                      row={row}
                      state={state}
                      onSelect={() => onSelectDay(row.index)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadingSelector — Programa | Historial real (tracker only)
// ---------------------------------------------------------------------------

type ReadingMode = 'program' | 'history';

interface ReadingSelectorProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}

function ReadingSelector({ mode, onChange }: ReadingSelectorProps): ReactNode {
  const { t } = useTranslation();
  return (
    <fieldset className="contents">
      <legend className="sr-only">{t('calendar_navigator.reading_mode_group_aria')}</legend>
      <div className="flex border border-rule overflow-hidden self-start">
        {(['program', 'history'] satisfies ReadingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`
              text-xs font-semibold px-3 py-1.5 min-h-[44px]
              transition-all duration-150 active:scale-95
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
              ${
                mode === m
                  ? 'bg-accent text-bg'
                  : 'bg-card text-muted hover:bg-hover-row hover:text-main'
              }
            `}
          >
            {t(`calendar_navigator.reading_mode.${m}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// HistoryView — completed sessions from resultTimestamps only
// ---------------------------------------------------------------------------

interface HistoryViewProps {
  rows: readonly GenericWorkoutRow[];
  resultTimestamps: Readonly<Record<string, string>> | undefined;
  completedDayIndices: ReadonlySet<number> | undefined;
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
}

function HistoryView({
  rows,
  resultTimestamps,
  completedDayIndices,
  selectedDayIndex,
  onSelectDay,
}: HistoryViewProps): ReactNode {
  const { t } = useTranslation();

  // Collect completed entries with their real timestamps (if available)
  const completedEntries: Array<{ index: number; timestamp: string | undefined }> = [];
  for (const row of rows) {
    const isCompleted =
      completedDayIndices !== undefined
        ? completedDayIndices.has(row.index)
        : resultTimestamps?.[String(row.index)] !== undefined;
    if (isCompleted) {
      completedEntries.push({
        index: row.index,
        timestamp: resultTimestamps?.[String(row.index)],
      });
    }
  }

  const hasHistory = completedEntries.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Microcopy */}
      <p className="text-xs text-muted italic" data-testid="history-microcopy">
        {t('calendar_navigator.history_microcopy')}
      </p>

      {!hasHistory && (
        <p className="text-xs text-muted" data-testid="history-empty">
          {t('calendar_navigator.history_empty')}
        </p>
      )}

      {hasHistory && (
        <div className="flex flex-col gap-1.5">
          {completedEntries.map(({ index, timestamp }) => {
            const isSelected = index === selectedDayIndex;
            const dateLabel = timestamp
              ? new Date(timestamp).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectDay(index)}
                aria-current={isSelected ? 'true' : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2 min-h-[44px] text-xs text-left
                  border transition-all duration-150 active:scale-95
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
                  ${
                    isSelected
                      ? 'border-accent bg-accent text-bg font-bold'
                      : 'border-rule bg-card text-main hover:bg-hover-row hover:border-rule-light'
                  }
                `}
              >
                <span className="font-mono tabular-nums font-bold text-accent shrink-0">
                  #{index + 1}
                </span>
                <span className="text-muted shrink-0">{rows[index]?.dayName ?? ''}</span>
                {dateLabel && (
                  <span className="ml-auto font-mono tabular-nums text-muted shrink-0">
                    {dateLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarNavigator
// ---------------------------------------------------------------------------

export function CalendarNavigator({
  rows,
  selectedDayIndex,
  currentDayIndex,
  workoutsPerWeek,
  resultTimestamps,
  completedDayIndices,
  context,
  onSelectDay,
}: CalendarNavigatorProps): ReactNode {
  const { t } = useTranslation();

  // Nav mode — persisted independently from compact/detailed ViewMode
  const [navMode, setNavMode] = useState<NavMode>(() => loadNavMode());

  // Reading mode — only relevant in tracker context
  const [readingMode, setReadingMode] = useState<ReadingMode>('program');

  function handleNavModeChange(mode: NavMode): void {
    setNavMode(mode);
    saveNavMode(mode);
    trackEvent('program_navigation_mode_change', { mode, context });
  }

  // In preview: always show program-relative calendar, no reading selector
  // In tracker: show reading selector (Programa | Historial real)
  const showReadingSelector = context === 'tracker';
  const showHistory = context === 'tracker' && readingMode === 'history';

  return (
    // data-context is used by integration tests and future CSS theming (preview vs tracker)
    <div className="flex flex-col gap-4" data-context={context}>
      {/* ── Preview badge: clarify this is program-relative ── */}
      {context === 'preview' && (
        <p
          className="text-2xs text-muted uppercase tracking-wide font-semibold"
          data-testid="preview-program-weeks-label"
        >
          {t('calendar_navigator.preview_program_weeks_label')}
        </p>
      )}

      {/* ── Tracker: reading selector ── */}
      {showReadingSelector && <ReadingSelector mode={readingMode} onChange={setReadingMode} />}

      {/* ── History view (tracker only) ── */}
      {showHistory ? (
        <HistoryView
          rows={rows}
          resultTimestamps={resultTimestamps}
          completedDayIndices={completedDayIndices}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={onSelectDay}
        />
      ) : (
        <>
          {/* ── Mode selector (program view) ── */}
          <NavModeSelector mode={navMode} onChange={handleNavModeChange} />

          {/* ── Mode-specific content ── */}
          {navMode === 'day' && (
            <DayView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              context={context}
              onSelectDay={onSelectDay}
            />
          )}

          {navMode === 'week' && (
            <WeekView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              workoutsPerWeek={workoutsPerWeek}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              onSelectDay={onSelectDay}
            />
          )}

          {navMode === 'month' && (
            <MonthView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              workoutsPerWeek={workoutsPerWeek}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              onSelectDay={onSelectDay}
            />
          )}

          {/* ── Jump to workout (always visible in week/month modes) ── */}
          {navMode !== 'day' && (
            <JumpForm rows={rows} context={context} onSelectDay={onSelectDay} />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JumpForm — extracted so it can be reused in week/month modes
// ---------------------------------------------------------------------------

interface JumpFormProps {
  rows: readonly GenericWorkoutRow[];
  context: 'preview' | 'tracker';
  onSelectDay: (index: number) => void;
}

function JumpForm({ rows, context, onSelectDay }: JumpFormProps): ReactNode {
  const { t } = useTranslation();
  const jumpInputId = useId();
  const jumpLabelId = useId();
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState(false);

  function handleJump(e?: FormEvent): void {
    e?.preventDefault();
    const parsed = parseInt(jumpValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > rows.length) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    setJumpValue('');
    trackEvent('program_navigation_jump', { context });
    onSelectDay(parsed - 1);
  }

  function handleJumpKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleJump();
  }

  return (
    <form
      onSubmit={handleJump}
      className="flex items-center gap-2"
      aria-label={t('calendar_navigator.jump_form_aria')}
    >
      <label
        id={jumpLabelId}
        htmlFor={jumpInputId}
        className="text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
      >
        {t('calendar_navigator.jump_label')}
      </label>
      <input
        id={jumpInputId}
        type="number"
        min={1}
        max={rows.length}
        value={jumpValue}
        onChange={(e) => {
          setJumpValue(e.target.value);
          setJumpError(false);
        }}
        onKeyDown={handleJumpKeyDown}
        aria-labelledby={jumpLabelId}
        aria-invalid={jumpError}
        aria-describedby={jumpError ? `${jumpInputId}-error` : undefined}
        placeholder={`1–${rows.length}`}
        className={`
          w-20 px-2 py-1.5 text-xs font-mono tabular-nums
          border bg-card text-main
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
          ${jumpError ? 'border-red-500' : 'border-rule'}
        `}
      />
      <button
        type="submit"
        aria-label={t('calendar_navigator.jump_button_aria')}
        className="
          text-xs font-bold px-3 py-1.5 min-h-[44px]
          border-2 border-rule bg-card text-muted
          hover:bg-hover-row hover:text-main hover:border-rule-light
          active:scale-95 cursor-pointer transition-all duration-150
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        "
      >
        {t('calendar_navigator.jump_button')}
      </button>
      {jumpError && (
        <span id={`${jumpInputId}-error`} role="alert" className="text-xs text-red-500">
          {t('calendar_navigator.jump_error', { max: rows.length })}
        </span>
      )}
    </form>
  );
}
