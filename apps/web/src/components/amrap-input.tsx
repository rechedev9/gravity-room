interface AmrapInputProps {
  readonly value: number | undefined;
  readonly onChange: (reps: number | undefined) => void;
  readonly variant?: 'table' | 'card';
}

const MIN_REPS = 0;
const MAX_REPS = 99;

export function AmrapInput({
  value,
  onChange,
  variant = 'table',
}: AmrapInputProps): React.ReactNode {
  const isCard = variant === 'card';
  const current = value ?? 0;

  const decrement = (): void => {
    if (current <= MIN_REPS) return;
    onChange(current - 1);
  };

  const increment = (): void => {
    if (current >= MAX_REPS) return;
    onChange(current + 1);
  };

  const btnBase = isCard
    ? 'min-w-[44px] min-h-[44px] text-base'
    : 'min-w-[44px] min-h-[44px] text-sm';

  const displayWidth = isCard ? 'w-12' : 'w-10';

  return (
    <div className="inline-flex items-stretch" role="group" aria-label="Reps AMRAP">
      <button
        type="button"
        onClick={decrement}
        disabled={current <= MIN_REPS}
        aria-label="Disminuir reps"
        className={`${btnBase} font-bold border-2 border-r-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-header)] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
      >
        &minus;
      </button>
      <span
        className={`${displayWidth} flex items-center justify-center py-1 text-center text-[13px] font-bold bg-transparent border-y-2 border-x-0 border-[var(--border-color)] text-[var(--text-header)] tabular-nums select-none`}
        aria-live="polite"
        aria-label="Reps AMRAP"
      >
        {value ?? 0}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={current >= MAX_REPS}
        aria-label="Aumentar reps"
        className={`${btnBase} font-bold border-2 border-l-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-header)] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
      >
        +
      </button>
    </div>
  );
}
