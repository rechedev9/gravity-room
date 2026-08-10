import { useMemo, useState, type ReactNode, type UIEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';

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

/** Row box (min-h 44) + 6px trailing gap. */
const ROW_STRIDE_PX = 50;
const LIST_MAX_HEIGHT_PX = 320;
/** Virtualize only when the full list would dominate layout/paint cost. */
const VIRTUALIZE_THRESHOLD = 40;
const OVERSCAN = 6;

interface HistoryEntry {
  readonly index: number;
  readonly timestamp: string | undefined;
}

function HistoryRow({
  entry,
  dayName,
  isSelected,
  onSelectDay,
  virtualized,
}: {
  readonly entry: HistoryEntry;
  readonly dayName: string;
  readonly isSelected: boolean;
  readonly onSelectDay: (index: number) => void;
  readonly virtualized: boolean;
}): ReactNode {
  const dateLabel = entry.timestamp
    ? new Date(entry.timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <button
      type="button"
      data-testid="history-row"
      data-history-index={entry.index}
      onClick={() => onSelectDay(entry.index)}
      aria-current={isSelected ? 'true' : undefined}
      style={virtualized ? { height: 44, marginBottom: 6, boxSizing: 'border-box' } : undefined}
      className={`
        flex items-center gap-3 px-3 py-2 min-h-[44px] w-full text-xs text-left
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
        #{entry.index + 1}
      </span>
      <span className="text-muted shrink-0">{dayName}</span>
      {dateLabel && (
        <span className="ml-auto font-mono tabular-nums text-muted shrink-0">{dateLabel}</span>
      )}
    </button>
  );
}

export function HistoryView({
  rows,
  resultTimestamps,
  completedDayIndices,
  selectedDayIndex,
  onSelectDay,
}: HistoryViewProps): ReactNode {
  const { t } = useTranslation();
  const [scrollTop, setScrollTop] = useState(0);

  const completedEntries = useMemo((): readonly HistoryEntry[] => {
    const entries: HistoryEntry[] = [];
    for (const row of rows) {
      const isCompleted =
        completedDayIndices !== undefined
          ? completedDayIndices.has(row.index)
          : resultTimestamps?.[String(row.index)] !== undefined;
      if (isCompleted) {
        entries.push({
          index: row.index,
          timestamp: resultTimestamps?.[String(row.index)],
        });
      }
    }
    return entries;
  }, [rows, resultTimestamps, completedDayIndices]);

  const hasHistory = completedEntries.length > 0;
  const virtualize = completedEntries.length > VIRTUALIZE_THRESHOLD;
  const viewportHeight = Math.min(
    LIST_MAX_HEIGHT_PX,
    Math.max(ROW_STRIDE_PX, completedEntries.length * ROW_STRIDE_PX)
  );

  const { start, end } = useMemo(() => {
    if (!virtualize) {
      return { start: 0, end: completedEntries.length };
    }
    const first = Math.max(0, Math.floor(scrollTop / ROW_STRIDE_PX) - OVERSCAN);
    const last = Math.min(
      completedEntries.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_STRIDE_PX) + OVERSCAN
    );
    return { start: first, end: last };
  }, [virtualize, scrollTop, viewportHeight, completedEntries.length]);

  const visibleEntries = completedEntries.slice(start, end);

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted italic" data-testid="history-microcopy">
        {t('calendar_navigator.history_microcopy')}
      </p>

      {!hasHistory && (
        <p className="text-xs text-muted" data-testid="history-empty">
          {t('calendar_navigator.history_empty')}
        </p>
      )}

      {hasHistory && !virtualize && (
        <div data-testid="history-list" data-virtualized="false" className="flex flex-col gap-1.5">
          {completedEntries.map((entry) => (
            <HistoryRow
              key={entry.index}
              entry={entry}
              dayName={rows[entry.index]?.dayName ?? ''}
              isSelected={entry.index === selectedDayIndex}
              onSelectDay={onSelectDay}
              virtualized={false}
            />
          ))}
        </div>
      )}

      {hasHistory && virtualize && (
        <div
          data-testid="history-list"
          data-virtualized="true"
          className="overflow-y-auto"
          style={{ height: viewportHeight }}
          onScroll={onScroll}
        >
          <div
            style={{
              height: completedEntries.length * ROW_STRIDE_PX,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${start * ROW_STRIDE_PX}px)`,
              }}
            >
              {visibleEntries.map((entry) => (
                <HistoryRow
                  key={entry.index}
                  entry={entry}
                  dayName={rows[entry.index]?.dayName ?? ''}
                  isSelected={entry.index === selectedDayIndex}
                  onSelectDay={onSelectDay}
                  virtualized
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
