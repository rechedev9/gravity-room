import { memo, useCallback } from 'react';

interface AmrapInputProps {
  readonly value: number | undefined;
  readonly onChange: (reps: number | undefined) => void;
  readonly variant?: 'table' | 'card';
}

const MIN_REPS = 0;
const MAX_REPS = 99;

export const AmrapInput = memo(function AmrapInput({
  value,
  onChange,
  variant = 'table',
}: AmrapInputProps): React.ReactNode {
  const isCard = variant === 'card';
  const current = value ?? 0;

  const decrement = useCallback((): void => {
    if (current <= MIN_REPS) return;
    onChange(current - 1);
  }, [current, onChange]);

  const increment = useCallback((): void => {
    if (current >= MAX_REPS) return;
    onChange(current + 1);
  }, [current, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const v = e.target.value;
      if (v === '') {
        onChange(undefined);
        return;
      }
      const parsed = parseInt(v, 10);
      if (isNaN(parsed)) return;
      onChange(Math.min(MAX_REPS, Math.max(MIN_REPS, parsed)));
    },
    [onChange]
  );

  const btnBase = isCard
    ? 'min-w-[44px] min-h-[44px] text-base'
    : 'min-w-[44px] min-h-[44px] text-sm';

  const inputWidth = isCard ? 'w-12' : 'w-10';

  return (
    <div className="inline-flex items-stretch" role="group" aria-label="Reps AMRAP">
      <button
        type="button"
        onClick={decrement}
        disabled={current <= MIN_REPS}
        aria-label="Disminuir reps"
        className={`${btnBase} font-bold border-2 border-r-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
      >
        &minus;
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_REPS}
        max={MAX_REPS}
        placeholder="—"
        value={value ?? ''}
        onChange={handleInputChange}
        className={`${inputWidth} px-0 py-1 text-center text-[13px] font-bold bg-transparent border-y-2 border-x-0 border-[var(--border-color)] text-[var(--text-main)] focus:border-[var(--fill-progress)] focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        aria-label="Reps AMRAP"
        title="Reps AMRAP"
      />
      <button
        type="button"
        onClick={increment}
        disabled={current >= MAX_REPS}
        aria-label="Aumentar reps"
        className={`${btnBase} font-bold border-2 border-l-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
      >
        +
      </button>
    </div>
  );
});
