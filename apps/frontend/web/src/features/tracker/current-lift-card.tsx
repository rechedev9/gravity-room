import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, SetLogEntry } from '@gzclp/domain/types';
import { localizedExerciseName } from '@/lib/catalog-display';
import { RepsAdjuster, SetIndicators } from '@/features/program-view/set-indicators';
import { SlotResultFooter } from '@/features/program-view/slot-result-footer';
import { SlotCardShell } from '@/features/program-view/slot-card-shell';
import type { SlotActions } from '@/features/program-view/day-view';
import { useUnitPreference } from '@/hooks/use-unit-preference';

export interface CurrentLiftCardProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly setLogs: readonly SetLogEntry[] | undefined;
  readonly isLogging: boolean;
  readonly onMark: SlotActions['onMark'];
  readonly onUndo: SlotActions['onUndo'];
  readonly onSetAmrapReps: SlotActions['onSetAmrapReps'];
  readonly onSetRpe?: SlotActions['onSetRpe'];
  readonly onSetTap?: SlotActions['onSetTap'];
}

/**
 * The lift the user is on, as the focal slot card: the load as hero number, the set dots, one
 * primary action ("confirm set N") and a quiet fail. Everything else in the session queues below.
 *
 * Slots the set-by-set model does not cover (prescription ladders, GPP,
 * test slots) keep the shared result footer as their action surface.
 */
export function CurrentLiftCard({
  slot,
  workoutIndex,
  setLogs,
  isLogging,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  onSetTap,
}: CurrentLiftCardProps): ReactNode {
  const { t } = useTranslation();
  const { unit, toDisplay } = useUnitPreference();
  const exerciseLabel = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;
  const isTestSlot = slot.isTestSlot === true;
  const supportsSetFlow = !hasPrescriptions && !isGpp && !isTestSlot && onSetTap !== undefined;
  const nextSetIndex = setLogs?.length ?? 0;
  const isAmrapSet = slot.isAmrap && nextSetIndex === slot.sets - 1;
  // The AMRAP set logs what the lifter did; it starts at the target so a plain hit is one tap.
  const [amrapEdit, setAmrapEdit] = useState<{ slotId: string; reps: number } | null>(null);
  const amrapReps = amrapEdit?.slotId === slot.slotId ? amrapEdit.reps : slot.reps;
  const showWeight = !isGpp && slot.isBodyweight !== true && slot.weight > 0;

  return (
    <SlotCardShell
      slot={slot}
      focal
      testId="current-lift-card"
      ariaLabel={t('tracker.current_lift.aria', { exercise: exerciseLabel })}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-end gap-5">
          {showWeight && (
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-[56px] leading-[0.8] tracking-[0.01em] text-accent tabular-nums sm:text-[64px]">
                {toDisplay(slot.weight)}
              </span>
              <span className="font-mono text-base font-semibold text-muted">{unit}</span>
            </p>
          )}
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

        {supportsSetFlow && onSetTap ? (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {isAmrapSet && (
              <div
                role="group"
                aria-label={t('tracker.set_stepper.group_aria_amrap', {
                  index: nextSetIndex + 1,
                  total: slot.sets,
                })}
                className="inline-flex items-center gap-1.5"
              >
                <RepsAdjuster
                  reps={amrapReps}
                  onChange={(reps) => setAmrapEdit({ slotId: slot.slotId, reps })}
                />
              </div>
            )}
            <button
              type="button"
              data-testid="current-lift-confirm-set"
              onClick={() => {
                onSetTap(
                  workoutIndex,
                  slot.slotId,
                  nextSetIndex,
                  isAmrapSet ? amrapReps : slot.reps
                );
                setAmrapEdit(null);
              }}
              style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
              className="type-button h-12 flex-1 rounded-control bg-accent px-4 text-on-accent whitespace-nowrap sm:px-7 cursor-pointer transition-[transform,background-color] duration-[var(--duration-press)] ease-[var(--ease-press)] hover:bg-accent-hover active:translate-y-px sm:flex-none"
            >
              {t('tracker.current_lift.confirm_set', { index: nextSetIndex + 1 })}
            </button>
            <button
              type="button"
              data-testid="current-lift-fail"
              onClick={() => onMark(workoutIndex, slot.slotId, 'fail')}
              aria-label={t('tracker.current_lift.fail_aria', { exercise: exerciseLabel })}
              className="type-button h-12 rounded-control px-4 text-muted cursor-pointer transition-colors duration-[var(--duration-press)] hover:bg-fail-bg hover:text-fail"
            >
              {t('tracker.current_lift.fail')}
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

      {/* AMRAP / RPE follow-ups stay reachable once the lift resolves. */}
      {supportsSetFlow && slot.result !== undefined && (
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
    </SlotCardShell>
  );
}
