import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { roundToNearest } from '@gzclp/domain/generic-engine';
import { DEFAULT_BAR_KG } from '@gzclp/domain/barbell';
import { localizedConfigFieldLabel } from '@/lib/catalog-display';
import { OneRmCalculator } from './one-rm-calculator';
import { PlateBreakdown } from './plate-breakdown';

type WeightField = ProgramDefinition['configFields'][number] & { type: 'weight' };

/** Reps the entered weight is meant to represent (GZCLP-style 5RM by default). */
const TARGET_REPS = 5;
export const MAX_WEIGHT_KG = 500;

export interface StepWeightsProps {
  readonly fields: readonly WeightField[];
  readonly values: Readonly<Record<string, number | undefined>>;
  readonly onChange: (key: string, weight: number | undefined) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

/**
 * One lift per screen instead of a three-column grid of empty number inputs:
 * a stepper, the plate breakdown for the number on screen, a 1RM calculator
 * and an explicit "I don't know" that starts from the bar.
 */
export function StepWeights({
  fields,
  values,
  onChange,
  onBack,
  onContinue,
}: StepWeightsProps): ReactNode {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const field = fields[index];
  if (field === undefined) return null;

  const label = localizedConfigFieldLabel(t, field.key, field.label);
  const current = values[field.key];
  const filled = fields.filter((f) => values[f.key] !== undefined).length;
  const isLast = index === fields.length - 1;

  const commit = (weight: number): void => {
    onChange(field.key, Math.min(MAX_WEIGHT_KG, Math.max(field.min, weight)));
  };

  const advance = (): void => {
    setCalculatorOpen(false);
    if (isLast) {
      onContinue();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div data-testid="start-step-weights" className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <p className="mb-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent-deep">
          {t('onboarding.weights.lift_counter', { index: index + 1, total: fields.length })}
        </p>
        <h2 className="font-display mb-3 text-[40px] leading-[0.9] tracking-[0.03em] text-title sm:text-[52px]">
          {label}
        </h2>
        <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-muted">
          {field.hint ?? t('onboarding.weights.subtitle')}
        </p>

        {calculatorOpen && (
          <OneRmCalculator
            targetReps={TARGET_REPS}
            step={field.step}
            onUse={(weight) => {
              commit(weight);
              setCalculatorOpen(false);
            }}
            onClose={() => setCalculatorOpen(false)}
          />
        )}

        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            aria-label={t('onboarding.weights.decrease', { lift: label })}
            onClick={() => commit(roundToNearest((current ?? field.min) - field.step, field.step))}
            className="h-14 w-14 border border-rule bg-card font-mono text-xl text-muted transition-colors hover:bg-surface-2 hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            &minus;
          </button>
          <span className="flex min-w-[160px] items-baseline justify-center gap-2 border border-rule bg-card px-5 py-2">
            <span
              data-testid="start-weight-value"
              className="font-display text-[44px] leading-none tracking-[0.01em] text-accent tabular-nums"
            >
              {current ?? '—'}
            </span>
            <span className="font-mono text-sm font-semibold text-muted">kg</span>
          </span>
          <button
            type="button"
            aria-label={t('onboarding.weights.increase', { lift: label })}
            onClick={() => commit(roundToNearest((current ?? field.min) + field.step, field.step))}
            className="h-14 w-14 border border-rule bg-card font-mono text-xl text-muted transition-colors hover:bg-surface-2 hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            +
          </button>
        </div>

        <div className="mb-6">
          <PlateBreakdown weight={current ?? 0} />
          <p className="mt-1 font-mono text-2xs text-info">
            {t('onboarding.weights.range', { min: field.min, max: MAX_WEIGHT_KG })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="start-weights-next"
            onClick={advance}
            disabled={current === undefined}
            style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
            className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {isLast ? t('onboarding.weights.finish') : t('onboarding.weights.next_lift')}
          </button>
          {!calculatorOpen && (
            <button
              type="button"
              data-testid="start-open-calculator"
              onClick={() => setCalculatorOpen(true)}
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted underline-offset-4 hover:text-main hover:underline cursor-pointer"
            >
              {t('onboarding.weights.open_calculator')}
            </button>
          )}
          <button
            type="button"
            data-testid="start-weights-unknown"
            onClick={() => {
              commit(Math.max(field.min, DEFAULT_BAR_KG));
              advance();
            }}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted underline-offset-4 hover:text-main hover:underline cursor-pointer"
          >
            {t('onboarding.weights.unknown')}
          </button>
          <button
            type="button"
            onClick={() => (index === 0 ? onBack() : setIndex((i) => i - 1))}
            className="ml-auto font-mono text-[11px] uppercase tracking-[0.06em] text-info hover:text-main cursor-pointer"
          >
            {t('onboarding.back')}
          </button>
        </div>
      </div>

      <aside className="border-rule bg-header p-5 xl:border-l">
        <h3 className="mb-3 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
          {t('onboarding.weights.your_loads', { filled, total: fields.length })}
        </h3>
        <ul>
          {fields.map((f) => (
            <li
              key={f.key}
              className={`flex items-baseline justify-between gap-3 border-b border-rule py-2 last:border-b-0 ${
                f.key === field.key ? 'text-title' : 'text-muted'
              }`}
            >
              <span className="min-w-0 truncate text-[12.5px]">
                {localizedConfigFieldLabel(t, f.key, f.label)}
              </span>
              <span className="shrink-0 font-mono text-[12.5px] tabular-nums">
                {values[f.key] !== undefined ? `${values[f.key]} kg` : '—'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-info">
          {t('onboarding.weights.derived_note')}
        </p>
      </aside>
    </div>
  );
}
