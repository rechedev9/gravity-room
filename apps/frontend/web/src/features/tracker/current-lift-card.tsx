import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, SetLogEntry } from '@gzclp/domain/types';
import { localizedExerciseName } from '@/lib/catalog-display';
import { SetIndicators } from '@/features/program-view/set-indicators';
import { SlotResultFooter } from '@/features/program-view/slot-result-footer';
import { tierColorClass } from '@/features/program-view/tier-color';
import type { SlotActions } from '@/features/program-view/day-view';
import { RestTimer } from './rest-timer';

export interface CurrentLiftCardProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly setLogs: readonly SetLogEntry[] | undefined;
  readonly isLogging: boolean;
  /** Active rest countdown, hosted inside this card instead of floating. */
  readonly rest: { readonly seconds: number; readonly id: number } | null;
  readonly onSkipRest: () => void;
  readonly onMark: SlotActions['onMark'];
  readonly onUndo: SlotActions['onUndo'];
  readonly onSetAmrapReps: SlotActions['onSetAmrapReps'];
  readonly onSetRpe?: SlotActions['onSetRpe'];
  readonly onSetTap?: SlotActions['onSetTap'];
}

/**
 * The lift the user is on, promoted to hero: 72px weight, 40px exercise name,
 * one primary action ("confirm set N") and the rest countdown docked to the
 * same card. Everything else in the session drops to a secondary grid.
 *
 * Slots the set-by-set model does not cover (prescription ladders, GPP,
 * test slots) keep the shared result footer as their action surface.
 */
export function CurrentLiftCard({
  slot,
  workoutIndex,
  setLogs,
  isLogging,
  rest,
  onSkipRest,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  onSetTap,
}: CurrentLiftCardProps): ReactNode {
  const { t } = useTranslation();
  const exerciseLabel = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;
  const isTestSlot = slot.isTestSlot === true;
  const supportsSetFlow = !hasPrescriptions && !isGpp && !isTestSlot && onSetTap !== undefined;
  const nextSetIndex = setLogs?.length ?? 0;
  const scheme = `${slot.sets}×${slot.complexReps ?? slot.reps}${slot.isAmrap ? '+' : ''}`;
  const stageLine =
    slot.stagesCount > 1
      ? t('tracker.current_lift.stage_scheme', { stage: slot.stage + 1, scheme })
      : scheme;

  return (
    <section
      data-testid="current-lift-card"
      data-slot-id={slot.slotId}
      aria-label={t('tracker.current_lift.aria', { exercise: exerciseLabel })}
      className="mb-4 border border-rule-light border-l-[3px] border-l-accent bg-card px-5 py-5 sm:px-6"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span
          className={`font-mono text-[11px] font-bold tracking-[0.1em] ${tierColorClass(slot.role)}`}
        >
          {slot.tier.toUpperCase()}
        </span>
        <span className="border border-accent-dim px-1.5 py-0.5 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-accent">
          {t('tracker.current_lift.in_progress')}
        </span>
        <span className="ml-auto font-mono text-[11px] text-info">{stageLine}</span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display mb-3 text-[32px] leading-[0.95] tracking-[0.03em] text-title sm:text-[40px]">
            {exerciseLabel}
          </h3>
          {!hasPrescriptions && !isGpp && (
            <SetIndicators
              sets={slot.sets}
              result={slot.result}
              isAmrap={slot.isAmrap}
              targetReps={slot.reps}
              setLogs={setLogs}
              committedSetLogs={slot.setLogs}
              onSetTap={
                onSetTap
                  ? (setIndex, reps) => onSetTap(workoutIndex, slot.slotId, setIndex, reps)
                  : undefined
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[56px] leading-[0.8] tracking-[0.01em] text-accent tabular-nums sm:text-[72px]">
              {slot.weight > 0 ? slot.weight : '—'}
            </span>
            {slot.weight > 0 && (
              <span className="font-mono text-base font-semibold text-muted">kg</span>
            )}
          </p>

          {supportsSetFlow && onSetTap ? (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="current-lift-confirm-set"
                onClick={() => onSetTap(workoutIndex, slot.slotId, nextSetIndex, slot.reps)}
                style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
                className="h-12 bg-accent px-6 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {t('tracker.current_lift.confirm_set', { index: nextSetIndex + 1 })}
              </button>
              <button
                type="button"
                data-testid="current-lift-fail"
                onClick={() => onMark(workoutIndex, slot.slotId, 'fail')}
                aria-label={t('tracker.current_lift.fail_aria', { exercise: exerciseLabel })}
                className="h-12 border-2 border-fail-ring bg-transparent px-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-fail transition-colors hover:bg-fail-bg cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                &#10007;
              </button>
            </div>
          ) : (
            <SlotResultFooter
              slot={slot}
              workoutIndex={workoutIndex}
              isLogging={isLogging}
              onMark={onMark}
              onUndo={onUndo}
              onSetAmrapReps={onSetAmrapReps}
              onSetRpe={onSetRpe}
            />
          )}
        </div>
      </div>

      {/* AMRAP / RPE follow-ups stay reachable once the lift resolves. */}
      {supportsSetFlow && slot.result !== undefined && (
        <div className="mt-4 border-t border-rule pt-4">
          <SlotResultFooter
            slot={slot}
            workoutIndex={workoutIndex}
            isLogging={isLogging}
            onMark={onMark}
            onUndo={onUndo}
            onSetAmrapReps={onSetAmrapReps}
            onSetRpe={onSetRpe}
          />
        </div>
      )}

      {rest !== null && (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          variant="inline"
          onSkip={onSkipRest}
          onComplete={onSkipRest}
        />
      )}
    </section>
  );
}
