import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition, GenericResults } from '@gzclp/domain/types/program';
import { previewSlotOutcome } from '@gzclp/domain/progression-preview';
import { SetIndicators } from '@/features/program-view/set-indicators';
import { SlotCardShell } from '@/features/program-view/slot-card-shell';
import { SlotResultFooter } from '@/features/program-view/slot-result-footer';
import type { SlotActions } from '@/features/program-view/day-view';
import { CurrentLiftCard } from './current-lift-card';
import { DayCompletedPanel } from './day-completed-panel';
import { FailureExplainer } from './failure-explainer';
import { SessionSidePanel } from './session-side-panel';
import { daysBetween, findPreviousSameDay, isSlotResolved } from './session-history';

export interface SessionViewProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly results: GenericResults;
  readonly rows: readonly GenericWorkoutRow[];
  readonly workout: GenericWorkoutRow;
  /** The selected day is the one the program is actually on. */
  readonly isCurrent: boolean;
  /** The selected day is the one just finished, so it gets the completion screen. */
  readonly showCompletion: boolean;
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  readonly onGoToNextDay: () => void;
  readonly onGoToProfile?: () => void;
  readonly slotActions: SlotActions;
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
  const { onMark, onUndo, onSetAmrapReps, onSetRpe, onSetTap, getSetLogs, isSlotLogging } =
    slotActions;
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;

  return (
    <SlotCardShell slot={slot}>
      {!hasPrescriptions && !isGpp && (
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
  const logged = slot.setLogs !== undefined && slot.setLogs.length > 0 ? slot.setLogs : null;

  return (
    <SlotCardShell slot={slot} testId="completed-slot-row">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {logged !== null && (
          <p className="font-mono text-[13px] text-label tabular-nums">
            {t('tracker.session_view.logged_reps', {
              reps: logged.map((entry) => entry.reps).join(' \u00b7 '),
            })}
          </p>
        )}
        {/* Undo lives where the mistake happened, next to the header one. */}
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
    </SlotCardShell>
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
  showCompletion,
  resultTimestamps,
  onGoToNextDay,
  onGoToProfile,
  slotActions,
}: SessionViewProps): ReactNode {
  const { t } = useTranslation();
  const { getSetLogs, isSlotLogging } = slotActions;

  const pending = workout.slots.filter((s) => !isSlotResolved(s));
  const completed = workout.slots.filter(isSlotResolved);
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
      ? // Undone from the header or with U: there is no failure left to explain.
        (workout.slots.find((s) => s.slotId === pendingFailSlotId && s.result === 'fail') ?? null)
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
  const showCompletedRows = !dayResolved || reviewing || !showCompletion;

  return (
    <div
      data-testid="session-view"
      className="grid grid-cols-1 items-start xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-4"
    >
      <div
        className="min-w-0"
        aria-label={t('tracker.day_view.workout_aria', { number: workout.index + 1 })}
      >
        {dayResolved && showCompletion && (
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
          <div className="mb-3">
            <CurrentLiftCard
              slot={hero}
              workoutIndex={workout.index}
              setLogs={getSetLogs?.(workout.index, hero.slotId)}
              isLogging={isSlotLogging?.(workout.index, hero.slotId) === true}
              onMark={slotActions.onMark}
              onUndo={slotActions.onUndo}
              onSetAmrapReps={slotActions.onSetAmrapReps}
              onSetRpe={slotActions.onSetRpe}
              onSetTap={slotActions.onSetTap}
            />
          </div>
        )}

        {secondary.length > 0 && (
          <div
            data-testid="compact-day-grid"
            className="grid grid-cols-1 items-start gap-3 md:grid-cols-2"
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
          <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
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
