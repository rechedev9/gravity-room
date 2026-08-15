import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow } from '@gzclp/domain/types';
import type { SlotOutcomeComparison } from '@gzclp/domain/progression-preview';
import { localizedExerciseName } from '@/lib/catalog-display';

export interface FailureExplainerProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  /** Engine-derived consequence of the failure that was just recorded. */
  readonly outcome: SlotOutcomeComparison;
  readonly onAcknowledge: () => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
}

function scheme(sets: number, reps: number, isAmrap: boolean): string {
  return `${sets} × ${reps}${isAmrap ? '+' : ''}`;
}

/**
 * A failed set is a rule firing, not a dead end — so the rule is shown on
 * screen: which stage you were on, which one comes next, and what happens to
 * the load. Every value comes from replaying the engine, never from copy.
 */
export function FailureExplainer({
  slot,
  workoutIndex,
  outcome,
  onAcknowledge,
  onUndo,
}: FailureExplainerProps): ReactNode {
  const { t } = useTranslation();
  const exerciseLabel = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);
  const { current, next, weightDelta, stageChanged } = outcome;

  const remainingStages = next.stagesCount - next.stage - 1;
  const body = stageChanged
    ? weightDelta < 0
      ? t('tracker.failure.body_deload', { percent: Math.abs(weightDelta), weight: next.weight })
      : remainingStages > 0
        ? t('tracker.failure.body_stage', { count: remainingStages })
        : t('tracker.failure.body_stage_last')
    : t('tracker.failure.body_hold', { weight: next.weight });

  return (
    <section
      data-testid="failure-explainer"
      data-slot-id={slot.slotId}
      aria-label={t('tracker.failure.aria', { exercise: exerciseLabel })}
      className="mb-4 border border-rule-light bg-card px-5 py-5 sm:px-6"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent">
          {t('tracker.failure.title')}
        </h3>
        <span className="h-px flex-1 bg-rule" aria-hidden="true" />
      </div>

      <ol className="mb-5 flex flex-wrap items-center gap-5">
        <li className="border border-rule bg-body px-5 py-3.5 opacity-60">
          <p className="mb-1 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {t('tracker.failure.stage_label', { stage: current.stage + 1 })}
          </p>
          <p className="font-mono text-[22px] font-semibold text-muted">
            {scheme(current.sets, current.reps, current.isAmrap)}
          </p>
        </li>
        <li aria-hidden="true" className="font-mono text-[26px] text-accent">
          &rarr;
        </li>
        <li className="border-2 border-accent bg-surface-2 px-5 py-3.5">
          <p className="mb-1 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent">
            {t('tracker.failure.next_stage_label', { stage: next.stage + 1 })}
          </p>
          <p className="font-mono text-[22px] font-bold text-title">
            {scheme(next.sets, next.reps, next.isAmrap)}
          </p>
        </li>
        <li className="border-l border-rule pl-5">
          <p className="mb-1 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
            {weightDelta < 0
              ? t('tracker.failure.weight_drops')
              : t('tracker.failure.weight_holds')}
          </p>
          <p className="font-mono text-[22px] font-semibold text-title tabular-nums">
            {next.weight} kg
          </p>
        </li>
      </ol>

      <p className="mb-5 max-w-[640px] text-[13.5px] leading-relaxed text-muted">{body}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="failure-acknowledge"
          onClick={onAcknowledge}
          style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
          className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {t('tracker.failure.continue')}
        </button>
        <button
          type="button"
          data-testid="failure-undo"
          onClick={() => onUndo(workoutIndex, slot.slotId)}
          className="border-[1.5px] border-rule-light px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {t('tracker.failure.undo')}
        </button>
        <span className="ml-auto hidden font-mono text-2xs text-info lg:inline">
          <kbd className="mr-1.5 border border-rule-light px-1.5 py-0.5 not-italic">U</kbd>
          {t('tracker.session_panel.shortcut_undo')}
        </span>
      </div>
    </section>
  );
}
