import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { estimateRepMaxFromOneRM } from '@gzclp/domain/barbell';

export interface OneRmCalculatorProps {
  /** Reps the program asks for (5 for a GZCLP-style 5RM). */
  readonly targetReps: number;
  readonly step: number;
  readonly onUse: (weight: number) => void;
  readonly onClose: () => void;
}

/**
 * "I only know my 1RM" — the escape hatch the old setup form never offered.
 * The Epley conversion itself lives in the domain package.
 */
export function OneRmCalculator({
  targetReps,
  step,
  onUse,
  onClose,
}: OneRmCalculatorProps): ReactNode {
  const { t } = useTranslation();
  const [oneRm, setOneRm] = useState('');
  const parsed = Number.parseFloat(oneRm);
  const estimate = Number.isFinite(parsed) ? estimateRepMaxFromOneRM(parsed, targetReps, step) : 0;

  return (
    <div
      data-testid="one-rm-calculator"
      className="mb-5 border border-rule bg-surface-2 px-4 py-3.5"
    >
      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent">
          {t('onboarding.weights.calculator_title')}
        </h3>
        <span className="h-px flex-1 bg-rule" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('onboarding.weights.calculator_close')}
          className="text-info transition-colors hover:text-main cursor-pointer"
        >
          &#10005;
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('onboarding.weights.calculator_input')}
          </span>
          <span className="flex items-baseline gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={step}
              value={oneRm}
              onChange={(e) => setOneRm(e.target.value)}
              className="w-24 border border-rule bg-card px-2 py-1 font-mono text-2xl text-title tabular-nums focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
            <span className="font-mono text-xs text-muted">kg</span>
          </span>
        </label>

        <span aria-hidden="true" className="pb-2 font-mono text-xl text-accent">
          &rarr;
        </span>

        <p className="flex flex-col gap-1">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('onboarding.weights.calculator_output', { reps: targetReps })}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span
              data-testid="one-rm-estimate"
              className="font-mono text-2xl text-title tabular-nums"
            >
              {estimate > 0 ? estimate : '—'}
            </span>
            <span className="font-mono text-xs text-muted">kg</span>
          </span>
        </p>

        <button
          type="button"
          data-testid="one-rm-use"
          onClick={() => onUse(estimate)}
          disabled={estimate <= 0}
          className="min-h-[40px] bg-accent px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {t('onboarding.weights.calculator_use', { weight: estimate > 0 ? estimate : '—' })}
        </button>
      </div>
    </div>
  );
}
