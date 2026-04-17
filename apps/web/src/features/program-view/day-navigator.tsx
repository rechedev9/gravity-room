import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface DayNavigatorProps {
  readonly selectedDayIndex: number;
  readonly totalDays: number;
  readonly currentDayIndex: number;
  readonly dayName: string;
  readonly isDayComplete: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToCurrent: () => void;
}

export function DayNavigator({
  selectedDayIndex,
  totalDays,
  currentDayIndex,
  dayName,
  isDayComplete,
  onPrev,
  onNext,
  onGoToCurrent,
}: DayNavigatorProps): ReactNode {
  const { t } = useTranslation();
  const showGoToCurrent = selectedDayIndex !== currentDayIndex && currentDayIndex !== -1;

  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        type="button"
        onClick={onPrev}
        disabled={selectedDayIndex <= 0}
        aria-label={t('tracker.day_navigator.prev_aria')}
        className="text-xs font-bold px-4 py-2.5 min-h-[44px] border-2 border-rule bg-card text-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
      >
        &larr;<span className="hidden sm:inline"> {t('tracker.day_navigator.prev_button')}</span>
      </button>

      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-main"
            style={{ fontSize: '22px', letterSpacing: '0.05em' }}
          >
            {t('tracker.day_navigator.day_label')} {selectedDayIndex + 1}
          </span>
          <span className="text-xs font-mono text-muted tabular-nums tracking-wide">
            / {totalDays}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold text-main uppercase tracking-wide">
              {dayName}
            </span>
            <span
              className="text-sm"
              aria-label={
                isDayComplete
                  ? t('tracker.day_navigator.completed_aria')
                  : t('tracker.day_navigator.pending_aria')
              }
            >
              {isDayComplete ? (
                <span className="text-accent">{'\u25CF'}</span>
              ) : (
                <span className="text-info">{'\u25CB'}</span>
              )}
            </span>
          </span>
          {showGoToCurrent && (
            <button
              type="button"
              onClick={onGoToCurrent}
              className="text-xs font-bold text-accent hover:underline cursor-pointer bg-transparent border-none min-h-[44px] px-2 inline-flex items-center"
            >
              &rarr; {t('tracker.day_navigator.go_to_current')}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={selectedDayIndex >= totalDays - 1}
        aria-label={t('tracker.day_navigator.next_aria')}
        className="text-xs font-bold px-4 py-2.5 min-h-[44px] border-2 border-rule bg-card text-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
      >
        <span className="hidden sm:inline">{t('tracker.day_navigator.next_button')} </span>&rarr;
      </button>
    </div>
  );
}
