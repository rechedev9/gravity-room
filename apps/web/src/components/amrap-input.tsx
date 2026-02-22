import { memo } from 'react';

interface AmrapInputProps {
  readonly value: number | undefined;
  readonly onChange: (reps: number | undefined) => void;
  readonly variant?: 'table' | 'card';
}

export const AmrapInput = memo(function AmrapInput({
  value,
  onChange,
  variant = 'table',
}: AmrapInputProps): React.ReactNode {
  const isCard = variant === 'card';

  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      max="99"
      placeholder="—"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0));
      }}
      className={`${isCard ? 'w-16 px-2 py-1.5 text-[13px]' : 'w-14 px-2 py-1.5 text-[13px]'} text-center font-bold bg-transparent border border-[var(--border-color)] text-[var(--text-main)] focus:border-[var(--fill-progress)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] tabular-nums`}
      aria-label="Reps AMRAP"
      title="Reps AMRAP"
    />
  );
});
