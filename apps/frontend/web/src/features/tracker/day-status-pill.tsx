import { useTranslation } from 'react-i18next';

interface DayStatusPillProps {
  readonly dayIndex: number;
  readonly totalDays: number;
  readonly dayName: string;
  readonly isComplete: boolean;
  readonly isCurrent: boolean;
  readonly navExpanded: boolean;
  readonly onToggleNav: () => void;
}

export function DayStatusPill({
  dayIndex,
  totalDays,
  dayName,
  isComplete,
  isCurrent,
  navExpanded,
  onToggleNav,
}: DayStatusPillProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 bg-card border border-rule ${
        navExpanded ? 'mb-0 rounded-t-[var(--radius-base)]' : 'mb-4 rounded-[var(--radius-base)]'
      }`}
    >
      <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="chalk-stamp text-label text-[10px] font-bold uppercase tracking-widest text-muted shrink-0">
          {isCurrent ? t('tracker.day_status.today_prefix') : ''}
          {t('tracker.day_status.day_label')} {dayIndex + 1} / {totalDays}
          {isComplete ? t('tracker.day_status.complete_suffix') : ''}
        </p>
        <span className="hidden h-4 w-px bg-rule sm:block" aria-hidden="true" />
        <p className="text-main font-bold truncate">{dayName || '—'}</p>
      </div>
      <button
        type="button"
        onClick={onToggleNav}
        aria-expanded={navExpanded}
        className="font-mono text-[10px] text-muted uppercase tracking-widest hover:text-main px-3 py-2 min-h-[44px] shrink-0"
      >
        {navExpanded ? t('tracker.day_status.close') : t('tracker.day_status.change_day')}
      </button>
    </div>
  );
}
