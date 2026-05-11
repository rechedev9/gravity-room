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
  return (
    <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 bg-card border border-rule rounded-[var(--radius-base)]">
      <div className="min-w-0 flex-1">
        <p className="chalk-stamp text-label text-[10px] font-bold uppercase tracking-widest text-muted">
          {isCurrent ? 'HOY · ' : ''}DÍA {dayIndex + 1} / {totalDays}
          {isComplete ? ' · COMPLETO' : ''}
        </p>
        <p className="text-main font-bold truncate">{dayName || '—'}</p>
      </div>
      <button
        type="button"
        onClick={onToggleNav}
        aria-expanded={navExpanded}
        className="font-mono text-[10px] text-muted uppercase tracking-widest hover:text-main px-3 py-2 shrink-0"
      >
        {navExpanded ? 'cerrar ▴' : 'cambiar día ▾'}
      </button>
    </div>
  );
}
