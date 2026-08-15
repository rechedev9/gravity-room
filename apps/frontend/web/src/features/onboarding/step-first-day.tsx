import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { localizedExerciseName } from '@/lib/catalog-display';
import { tierColorClass } from '@/features/program-view/tier-color';

export interface StepFirstDayProps {
  readonly definition: ProgramDefinition;
  readonly firstWorkout: GenericWorkoutRow;
  /** Day names of one full cycle, for the "your week" rail. */
  readonly cycleDayNames: readonly string[];
  readonly isGenerating: boolean;
  readonly onStart: () => void;
  readonly onSaveForLater: () => void;
  readonly onBack: () => void;
}

/**
 * Day one is shown before it is entered: which lifts, which loads, and how the
 * program reacts to a success and to a failure. The old flow dropped a new
 * lifter into the same screen as someone on session two hundred.
 */
export function StepFirstDay({
  definition,
  firstWorkout,
  cycleDayNames,
  isGenerating,
  onStart,
  onSaveForLater,
  onBack,
}: StepFirstDayProps): ReactNode {
  const { t } = useTranslation();

  return (
    <div
      data-testid="start-step-first-day"
      className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="min-w-0">
        <p className="mb-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent-deep">
          {t('onboarding.first_day.kicker', { name: firstWorkout.dayName })}
        </p>
        <h2 className="font-display mb-3 text-[40px] leading-[0.9] tracking-[0.03em] text-title sm:text-[52px]">
          {t('onboarding.first_day.title')}
        </h2>
        <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-muted">
          {t('onboarding.first_day.subtitle', { count: firstWorkout.slots.length })}
        </p>

        <ul className="mb-7 flex flex-col gap-0.5">
          {firstWorkout.slots.map((slot) => (
            <li
              key={slot.slotId}
              data-testid="start-first-day-slot"
              className="flex flex-wrap items-center gap-4 border border-rule bg-card px-4 py-3.5"
            >
              <span className={`w-6 font-mono text-[11px] font-bold ${tierColorClass(slot.role)}`}>
                {slot.tier.toUpperCase()}
              </span>
              <span className="text-[14.5px] font-bold text-title">
                {localizedExerciseName(t, slot.exerciseId, slot.exerciseName)}
              </span>
              <span className="font-mono text-[13px] text-info tabular-nums">
                {slot.sets}
                {'×'}
                {slot.complexReps ?? slot.reps}
                {slot.isAmrap ? '+' : ''}
              </span>
              <span className="ml-auto font-mono text-[15px] font-bold text-title tabular-nums">
                {slot.weight > 0 ? `${slot.weight} kg` : t('onboarding.first_day.your_choice')}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="start-begin-day"
            onClick={onStart}
            disabled={isGenerating}
            style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
            className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {isGenerating ? t('onboarding.first_day.starting') : t('onboarding.first_day.start')}
          </button>
          <button
            type="button"
            data-testid="start-save-for-later"
            onClick={onSaveForLater}
            disabled={isGenerating}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted underline-offset-4 hover:text-main hover:underline disabled:opacity-60 cursor-pointer"
          >
            {t('onboarding.first_day.save_for_later')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="ml-auto font-mono text-[11px] uppercase tracking-[0.06em] text-info hover:text-main cursor-pointer"
          >
            {t('onboarding.back')}
          </button>
        </div>
      </div>

      <aside className="flex flex-col gap-6 border-rule bg-header p-5 xl:border-l">
        <div>
          <h3 className="mb-3 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('onboarding.first_day.how_it_progresses')}
          </h3>
          <p className="mb-2 flex gap-2.5 text-[12.5px] leading-relaxed text-muted">
            <span aria-hidden="true" className="font-mono text-ok">
              &#10003;
            </span>
            {t('onboarding.first_day.progress_success')}
          </p>
          <p className="flex gap-2.5 text-[12.5px] leading-relaxed text-muted">
            <span aria-hidden="true" className="font-mono text-fail">
              &#10007;
            </span>
            {t('onboarding.first_day.progress_fail')}
          </p>
        </div>

        <div className="border border-rule bg-card px-4 py-3.5">
          <h3 className="mb-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('onboarding.first_day.change_mind_title')}
          </h3>
          <p className="text-[12.5px] leading-relaxed text-muted">
            {t('onboarding.first_day.change_mind_body')}
          </p>
        </div>

        <div>
          <h3 className="mb-3 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('onboarding.first_day.your_week')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {cycleDayNames.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className={`border px-2 py-1 font-mono text-[11px] ${
                  i === 0 ? 'border-accent text-accent' : 'border-rule text-muted'
                }`}
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-2xs text-info">
            {t('onboarding.first_day.total_sessions', { count: definition.totalWorkouts })}
          </p>
        </div>
      </aside>
    </div>
  );
}
