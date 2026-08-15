import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type StartStep = 'program' | 'weights' | 'first-day';

export const START_STEPS: readonly StartStep[] = ['program', 'weights', 'first-day'];

export interface StartStepperProps {
  readonly current: StartStep;
  /** Short trailing note per completed step, e.g. the chosen program name. */
  readonly notes?: Partial<Record<StartStep, string>>;
}

const STEP_LABEL_KEYS: Readonly<Record<StartStep, string>> = {
  program: 'onboarding.step_program',
  weights: 'onboarding.step_weights',
  'first-day': 'onboarding.step_first_day',
};

/** Three dashes, one decision each — the spine of the guided start. */
export function StartStepper({ current, notes }: StartStepperProps): ReactNode {
  const { t } = useTranslation();
  const currentIndex = START_STEPS.indexOf(current);

  return (
    <ol
      data-testid="start-stepper"
      aria-label={t('onboarding.stepper_aria')}
      className="mb-8 flex flex-wrap gap-6"
    >
      {START_STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        const note = notes?.[step];
        return (
          <li
            key={step}
            data-step={step}
            data-state={state}
            className="flex min-w-[140px] flex-1 flex-col gap-2"
          >
            <span
              aria-hidden="true"
              className={`h-[3px] ${state === 'todo' ? 'bg-rule' : 'bg-accent'}`}
            />
            <span
              className={`font-mono text-2xs font-bold uppercase tracking-[0.08em] ${
                state === 'todo' ? 'text-info' : 'text-accent'
              }`}
            >
              {String(index + 1).padStart(2, '0')} {t(STEP_LABEL_KEYS[step])}
              {note !== undefined && note !== '' ? ` · ${note}` : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
