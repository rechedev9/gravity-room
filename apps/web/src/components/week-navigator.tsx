import type { ReactNode } from 'react';

interface WeekNavigatorProps {
  readonly selectedWeek: number;
  readonly totalWeeks: number;
  readonly currentWeekNumber: number;
  readonly weekDoneCount: number;
  readonly weekTotalCount: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToCurrent: () => void;
}

export function WeekNavigator({
  selectedWeek,
  totalWeeks,
  currentWeekNumber,
  weekDoneCount,
  weekTotalCount,
  onPrev,
  onNext,
  onGoToCurrent,
}: WeekNavigatorProps): ReactNode {
  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        type="button"
        onClick={onPrev}
        disabled={selectedWeek <= 1}
        aria-label="Semana anterior"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 min-h-[44px] border-2 border-rule bg-card text-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
      >
        &larr; Anterior
      </button>

      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-main"
            style={{ fontSize: '22px', letterSpacing: '0.05em' }}
          >
            Semana {selectedWeek}
          </span>
          <span
            className="font-mono text-muted tabular-nums"
            style={{ fontSize: '12px', letterSpacing: '0.1em' }}
          >
            / {totalWeeks}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-mono"
            style={{ fontSize: '14px', letterSpacing: '0.3em' }}
            aria-label={`${weekDoneCount} de ${weekTotalCount} entrenamientos completados`}
            title={`${weekDoneCount} de ${weekTotalCount} entrenamientos completados`}
          >
            <span className="text-accent">{'\u25CF'.repeat(weekDoneCount)}</span>
            <span className="text-info">{'\u25CB'.repeat(weekTotalCount - weekDoneCount)}</span>
          </span>
          {selectedWeek !== currentWeekNumber && (
            <button
              type="button"
              onClick={onGoToCurrent}
              className="font-mono text-xs font-bold tracking-widest uppercase text-accent hover:underline cursor-pointer bg-transparent border-none min-h-[44px] px-2 inline-flex items-center"
            >
              &rarr; Actual
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={selectedWeek >= totalWeeks}
        aria-label="Siguiente semana"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 min-h-[44px] border-2 border-rule bg-card text-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
      >
        Siguiente &rarr;
      </button>
    </div>
  );
}
