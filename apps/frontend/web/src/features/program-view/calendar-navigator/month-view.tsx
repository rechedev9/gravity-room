import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import {
  clamp,
  resolveTileState,
  totalWeeks,
  weekIndexForDay,
  WEEKS_PER_MONTH_PAGE,
} from './shared';
import type { TileState } from './shared';

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

export function MonthView({
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
