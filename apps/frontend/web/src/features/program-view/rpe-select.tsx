import type { ReactNode } from 'react';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

interface RpeSelectProps {
  readonly value: number | undefined;
  readonly onChange: (rpe: number | undefined) => void;
  readonly workoutIndex: number;
  readonly slotKey: string;
}

/**
 * Compact RPE selector for table cells. Styled to match the dark theme and the
 * weight steppers: a bordered card-surface control with the native chevron
 * suppressed and a custom one drawn on top, so it reads as a deliberate control
 * rather than a raw browser widget.
 */
export function RpeSelect({ value, onChange, workoutIndex, slotKey }: RpeSelectProps): ReactNode {
  const hasValue = value !== undefined;
  return (
    <span className="relative inline-flex items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted"
      >
        {'▾'}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? Number(v) : undefined);
        }}
        data-rpe-input={`${workoutIndex}-${slotKey}`}
        aria-label="RPE"
        className={`appearance-none bg-card border border-rule text-xs font-bold pl-2.5 pr-6 py-1.5 min-h-[36px] min-w-[72px] cursor-pointer rounded-[var(--radius-base)] transition-colors hover:border-rule-light focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
          hasValue ? 'text-main' : 'text-muted'
        }`}
      >
        <option value="">{'RPE -'}</option>
        {RPE_VALUES.map((v) => (
          <option key={v} value={v}>
            {`RPE ${v}`}
          </option>
        ))}
      </select>
    </span>
  );
}
