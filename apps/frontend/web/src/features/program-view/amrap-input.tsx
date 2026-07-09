import { useTranslation } from 'react-i18next';
import { computeEpley1RM, roundToNearest } from '@gzclp/domain';

interface AmrapInputProps {
  readonly value: number | undefined;
  readonly onChange: (reps: number | undefined) => void;
  readonly variant?: 'table' | 'card';
  readonly weight?: number;
  readonly result?: string;
}

const MIN_REPS = 0;
const MAX_REPS = 99;

const HALF_KG = 0.5;

/** Epley 1RM estimate rounded to 0.5 kg. */
function estimate1RM(weight: number, reps: number): number {
  return roundToNearest(computeEpley1RM(weight, reps), HALF_KG);
}

export function AmrapInput({
  value,
  onChange,
  variant = 'table',
  weight,
  result,
}: AmrapInputProps): React.ReactNode {
  const { t } = useTranslation();
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

  const showEstimate =
    result === 'success' && weight !== undefined && value !== undefined && value >= 1;

  return (
    <div className="inline-flex flex-col items-center">
      <div
        className="inline-flex items-stretch"
        role="group"
        aria-label={t('tracker.amrap_input.group_label')}
      >
        <button
          type="button"
          onClick={decrement}
          disabled={current <= MIN_REPS}
          aria-label={t('tracker.amrap_input.decrement_label')}
          className={`${btnBase} font-bold border-2 border-r-0 border-rule bg-card text-btn-text cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-title active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
        >
          &minus;
        </button>
        <span
          className={`${displayWidth} flex items-center justify-center py-1 text-center text-[13px] font-bold bg-transparent border-y-2 border-x-0 border-rule text-title tabular-nums select-none`}
          aria-live="polite"
          aria-label={t('tracker.amrap_input.group_label')}
        >
          {value !== undefined ? value : '\u2014'}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={current >= MAX_REPS}
          aria-label={t('tracker.amrap_input.increment_label')}
          className={`${btnBase} font-bold border-2 border-l-0 border-rule bg-card text-btn-text cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-title active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-30 disabled:cursor-default`}
        >
          +
        </button>
      </div>
      {showEstimate && (
        <span className="text-[10px] text-muted mt-0.5 block text-center">
          {t('tracker.amrap_input.estimated_1rm_prefix')} {estimate1RM(weight, value)} kg
        </span>
      )}
    </div>
  );
}
