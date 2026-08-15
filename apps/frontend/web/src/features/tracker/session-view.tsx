import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition, GenericResults } from '@gzclp/domain/types/program';
import { previewSlotOutcome } from '@gzclp/domain/progression-preview';
import { localizedExerciseName } from '@/lib/catalog-display';
import { SetIndicators } from '@/features/program-view/set-indicators';
import { SlotCardShell } from '@/features/program-view/slot-card-shell';
import { SlotResultFooter } from '@/features/program-view/slot-result-footer';
import { tierColorClass } from '@/features/program-view/tier-color';
import type { SlotActions } from '@/features/program-view/day-view';
import { CurrentLiftCard } from './current-lift-card';
import { DayCompletedPanel } from './day-completed-panel';
import { FailureExplainer } from './failure-explainer';
import { SessionSidePanel } from './session-side-panel';
import { daysBetween, findPreviousSameDay } from './session-history';

export interface SessionViewProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly results: GenericResults;
  readonly rows: readonly GenericWorkoutRow[];
  readonly workout: GenericWorkoutRow;
  /** The selected day is the one the program is actually on. */
  readonly isCurrent: boolean;
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  readonly rest: { readonly seconds: number; readonly id: number } | null;
  readonly onSkipRest: () => void;
  readonly onGoToNextDay: () => void;
  readonly onGoToProfile?: () => void;
  readonly slotActions: SlotActions;
}

/** A slot is finished only once its AMRAP follow-up (if any) has been answered. */
function isResolved(slot: GenericSlotRow): boolean {
  if (slot.result === undefined) return false;
  const needsAmrap =
    slot.result === 'success' &&
    slot.isAmrap &&
    slot.amrapReps === undefined &&
    slot.setLogs === undefined;
  return !needsAmrap;
}

function SecondarySlotCard({
  slot,
  workoutIndex,
  slotActions,
}: {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly slotActions: SlotActions;
}): ReactNode {
  const { t } = useTranslation();
  const { onMark, onUndo, onSetAmrapReps, onSetRpe, onSetTap, getSetLogs, isSlotLogging } =
    slotActions;
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;
  const isBodyweight = slot.isBodyweight === true;
  const showWeight = !isGpp && !isBodyweight && slot.weight > 0;

  return (
    <SlotCardShell slot={slot} isCurrent={false}>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[26px] font-semibold leading-none text-main tabular-nums">
          {showWeight ? `${slot.weight} kg` : '—'}
        </span>
        <span className="font-mono text-xs text-info tabular-nums">
          {slot.sets}
          {'×'}
          {slot.complexReps ?? slot.reps}
          {slot.repsMax !== undefined ? `–${slot.repsMax}` : ''}
          {slot.isAmrap ? '+' : ''}
        </span>
      </div>

      {!hasPrescriptions && !isGpp && (
        <div className="mb-3">
          <SetIndicators
            sets={slot.sets}
            result={slot.result}
            isAmrap={slot.isAmrap}
            targetReps={slot.reps}
            setLogs={getSetLogs?.(workoutIndex, slot.slotId)}
            committedSetLogs={slot.setLogs}
            onSetTap={
              onSetTap && slot.result === undefined
                ? (setIndex, reps) => onSetTap(workoutIndex, slot.slotId, setIndex, reps)
                : undefined
            }
          />
        </div>
      )}

      <SlotResultFooter
        slot={slot}
        workoutIndex={workoutIndex}
        isLogging={isSlotLogging?.(workoutIndex, slot.slotId) === true}
        onMark={onMark}
        onUndo={onUndo}
        onSetAmrapReps={onSetAmrapReps}
        onSetRpe={onSetRpe}
      />
      <span className="sr-only">{t('tracker.session_view.pending_aria')}</span>
    </SlotCardShell>
  );
}

function CompletedSlotRow({
  slot,
  workoutIndex,
  slotActions,
}: {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly slotActions: SlotActions;
}): ReactNode {
  const { t } = useTranslation();
  const label = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);
  const reps =
    slot.setLogs !== undefined && slot.setLogs.length > 0
      ? slot.setLogs.map((s) => s.reps).join(' ')
      : `${slot.sets}×${slot.complexReps ?? slot.reps}`;

  return (
    <div
      data-testid="completed-slot-row"
      data-slot-result={slot.result}
      className="flex flex-wrap items-center gap-3.5 border border-rule bg-body px-4 py-3 opacity-70 transition-opacity hover:opacity-100"
    >
      <span className={`font-mono text-[11px] font-bold ${tierColorClass(slot.role)}`}>
        {slot.tier.toUpperCase()}
      </span>
      <span className="text-[13.5px] text-muted">{label}</span>
      <span className="font-mono text-[13px] text-muted tabular-nums">
        {slot.weight > 0 ? `${slot.weight} kg · ` : ''}
        {reps}
      </span>
      <span
        className={`ml-auto font-mono text-[11px] uppercase tracking-[0.06em] ${
          slot.result === 'fail' ? 'text-fail' : 'text-ok'
        }`}
      >
        {slot.result === 'fail'
          ? t('tracker.session_view.failed')
          : t('tracker.session_view.completed')}
      </span>
      {/* Undo lives where the mistake happened, not in the chrome. */}
      <SlotResultFooter
        slot={slot}
        workoutIndex={workoutIndex}
        isLogging={slotActions.isSlotLogging?.(workoutIndex, slot.slotId) === true}
        onMark={slotActions.onMark}
        onUndo={slotActions.onUndo}
        onSetAmrapReps={slotActions.onSetAmrapReps}
        onSetRpe={slotActions.onSetRpe}
      />
    </div>
  );
}

/**
 * A session as one screen: the lift in progress as hero, the rest of the day
 * in a two-column grid, what is already done demoted to rows, and a standing
 * context rail on the right.
 */
export function SessionView({
  definition,
  config,
  results,
  rows,
  workout,
  isCurrent,
  resultTimestamps,
  rest,
  onSkipRest,
  onGoToNextDay,
  onGoToProfile,
  slotActions,
}: SessionViewProps): ReactNode {
  const { t } = useTranslation();
  const { getSetLogs, isSlotLogging } = slotActions;

  const pending = workout.slots.filter((s) => !isResolved(s));
  const completed = workout.slots.filter(isResolved);
  const hero = isCurrent ? (pending[0] ?? null) : null;
  const secondary = hero !== null ? pending.slice(1) : pending;

  const previous = useMemo(() => findPreviousSameDay(rows, workout.index), [rows, workout.index]);
  const previousDaysAgo =
    previous !== null
      ? daysBetween(
          resultTimestamps?.[String(previous.index)],
          resultTimestamps?.[String(workout.index)] ?? new Date().toISOString()
        )
      : null;

  const failPreview = useMemo(
    () =>
      hero !== null
        ? previewSlotOutcome(definition, config, results, workout.index, hero.slotId, 'fail')
        : null,
    [definition, config, results, workout.index, hero]
  );

  // A failure explains itself once, right after it is recorded — not on every
  // later visit to the same day.
  const [pendingFailSlotId, setPendingFailSlotId] = useState<string | null>(null);
  const seenFailures = useRef<{ index: number; failures: ReadonlySet<string> } | null>(null);
  const failedSlotIds = workout.slots
    .filter((s) => s.result === 'fail' && s.stagesCount > 1)
    .map((s) => s.slotId)
    .join('|');

  useEffect(() => {
    const failures = new Set(failedSlotIds === '' ? [] : failedSlotIds.split('|'));
    const seen = seenFailures.current;
    seenFailures.current = { index: workout.index, failures };
    // Landing on a day only records the baseline — nothing "just failed" there,
    // and a pending explainer must not survive a day switch.
    if (seen === null || seen.index !== workout.index) {
      setPendingFailSlotId(null);
      return;
    }
    const fresh = [...failures].find((id) => !seen.failures.has(id));
    if (fresh !== undefined) setPendingFailSlotId(fresh);
  }, [failedSlotIds, workout.index]);

  const failedSlot =
    pendingFailSlotId !== null
      ? (workout.slots.find((s) => s.slotId === pendingFailSlotId) ?? null)
      : null;
  const failureLadder = useMemo(() => {
    if (failedSlot === null) return [];
    for (const day of definition.days) {
      const def = day.slots.find((slotDef) => slotDef.id === failedSlot.slotId);
      if (def !== undefined) {
        return def.stages.map((stage) => ({
          sets: stage.sets,
          reps: stage.reps,
          isAmrap: stage.amrap === true,
        }));
      }
    }
    return [];
  }, [definition, failedSlot]);

  const failureOutcome = useMemo(
    () =>
      failedSlot !== null
        ? previewSlotOutcome(definition, config, results, workout.index, failedSlot.slotId, 'fail')
        : null,
    [definition, config, results, workout.index, failedSlot]
  );

  const dayResolved = pending.length === 0 && workout.slots.length > 0;
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => setReviewing(false), [workout.index]);
  const showCompletedRows = !dayResolved || reviewing || !isCurrent;

  return (
    <div
      data-testid="session-view"
      className="grid grid-cols-1 items-start xl:grid-cols-[minmax(0,1fr)_280px]"
    >
      <div
        className="min-w-0 px-0 py-5 sm:px-2"
        aria-label={t('tracker.day_view.workout_aria', { number: workout.index + 1 })}
      >
        {dayResolved && isCurrent && (
          <DayCompletedPanel
            rows={rows}
            workout={workout}
            totalDays={definition.totalWorkouts}
            nextWorkout={rows[workout.index + 1] ?? null}
            onGoToNextDay={onGoToNextDay}
            onReview={() => setReviewing((x) => !x)}
          />
        )}

        {failedSlot !== null && failureOutcome !== null && (
          <FailureExplainer
            slot={failedSlot}
            workoutIndex={workout.index}
            ladder={failureLadder}
            outcome={failureOutcome}
            onAcknowledge={() => setPendingFailSlotId(null)}
            onUndo={(index, slotId) => {
              setPendingFailSlotId(null);
              slotActions.onUndo(index, slotId);
            }}
          />
        )}

        {hero !== null && (
          <CurrentLiftCard
            slot={hero}
            workoutIndex={workout.index}
            setLogs={getSetLogs?.(workout.index, hero.slotId)}
            isLogging={isSlotLogging?.(workout.index, hero.slotId) === true}
            rest={rest}
            onSkipRest={onSkipRest}
            onMark={slotActions.onMark}
            onUndo={slotActions.onUndo}
            onSetAmrapReps={slotActions.onSetAmrapReps}
            onSetRpe={slotActions.onSetRpe}
            onSetTap={slotActions.onSetTap}
          />
        )}

        {secondary.length > 0 && (
          <div
            data-testid="compact-day-grid"
            className="grid grid-cols-1 items-start gap-4 md:grid-cols-2"
          >
            {secondary.map((slot) => (
              <SecondarySlotCard
                key={slot.slotId}
                slot={slot}
                workoutIndex={workout.index}
                slotActions={slotActions}
              />
            ))}
          </div>
        )}

        {showCompletedRows && completed.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {completed.map((slot) => (
              <CompletedSlotRow
                key={slot.slotId}
                slot={slot}
                workoutIndex={workout.index}
                slotActions={slotActions}
              />
            ))}
          </div>
        )}
      </div>

      <SessionSidePanel
        previous={previous}
        previousDaysAgo={previousDaysAgo}
        failPreview={failPreview}
        onGoToProfile={onGoToProfile}
      />
    </div>
  );
}
