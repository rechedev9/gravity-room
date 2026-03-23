import type { ReactNode } from 'react';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

interface RpeSelectProps {
  readonly value: number | undefined;
  readonly onChange: (rpe: number | undefined) => void;
  readonly workoutIndex: number;
  readonly slotKey: string;
}

/** Compact RPE selector for table cells — replaces the 5-button pill strip. */
export function RpeSelect({ value, onChange, workoutIndex, slotKey }: RpeSelectProps): ReactNode {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? Number(v) : undefined);
      }}
      data-rpe-input={`${workoutIndex}-${slotKey}`}
      aria-label="RPE"
      className="bg-card text-main border border-rule text-xs font-bold px-1.5 py-1.5 min-h-[36px] min-w-[52px] cursor-pointer rounded-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <option value="">{'\u2014'}</option>
      {RPE_VALUES.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}
