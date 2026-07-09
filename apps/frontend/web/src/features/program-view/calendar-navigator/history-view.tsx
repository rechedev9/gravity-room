import type { ReactNode } from 'react';
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

export function HistoryView({
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
