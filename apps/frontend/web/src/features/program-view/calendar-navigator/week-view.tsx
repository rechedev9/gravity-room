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
