import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { clamp, resolveTileState, totalWeeks, weekIndexForDay } from './shared';
import type { TileState } from './shared';

// ---------------------------------------------------------------------------
// DayTile
// ---------------------------------------------------------------------------

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
// WeekView — compact week selector + active week grid
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

export function WeekView({
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
  const selectWeek = (weekIndex: number): void => {
    onSelectDay(clamp(weekIndex * safeWpw, 0, rows.length - 1));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={activeWeek <= 0}
          onClick={() => selectWeek(activeWeek - 1)}
          aria-label={t('calendar_navigator.week_prev_aria')}
          className="flex h-11 w-11 items-center justify-center border border-rule bg-card text-sm font-bold text-muted transition-colors hover:border-rule-light hover:text-main disabled:cursor-not-allowed disabled:opacity-30"
        >
          &larr;
        </button>
        <select
          value={activeWeek}
          onChange={(event) => selectWeek(Number(event.currentTarget.value))}
          aria-label={t('calendar_navigator.week_select_aria')}
          className="h-11 min-w-40 cursor-pointer border border-rule bg-card px-3 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {weekChips.map((weekIdx) => {
            const firstDayOfWeek = weekIdx * safeWpw + 1;
            const lastDayOfWeek = Math.min((weekIdx + 1) * safeWpw, rows.length);
            return (
              <option key={weekIdx} value={weekIdx}>
                {t('calendar_navigator.week_option', {
                  week: weekIdx + 1,
                  from: firstDayOfWeek,
                  to: lastDayOfWeek,
                })}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          disabled={activeWeek >= numWeeks - 1}
          onClick={() => selectWeek(activeWeek + 1)}
          aria-label={t('calendar_navigator.week_next_aria')}
          className="flex h-11 w-11 items-center justify-center border border-rule bg-card text-sm font-bold text-muted transition-colors hover:border-rule-light hover:text-main disabled:cursor-not-allowed disabled:opacity-30"
        >
          &rarr;
        </button>
      </div>

      {/* Week grid */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('calendar_navigator.week_grid_aria', { week: activeWeek + 1 })}
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
