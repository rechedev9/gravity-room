import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow } from '@gzclp/domain/types';
import type { DayViewProps } from './day-view';
import { SlotCardShell } from './slot-card-shell';
import { SlotResultFooter } from './slot-result-footer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EM_DASH = '\u2014';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents a single row in the per-set table. */
interface SetTableRow {
  readonly setIndex: number;
  /** Label: "W1", "W2" for warm-ups; "1", "2", "3" for working sets. */
  readonly label: string;
  readonly plannedWeight: number | undefined;
  readonly plannedReps: number;
  readonly isAmrap: boolean;
  readonly isWarmup: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the set table rows for a slot.
 * Handles standard, prescription, GPP, and bodyweight slot types.
 */
export function buildSetRows(slot: GenericSlotRow): readonly SetTableRow[] {
  const isGpp = slot.isGpp === true;
  const isBodyweight = slot.isBodyweight === true;
  const noWeight = isGpp || isBodyweight;

  // Prescription slots: individual warm-up + working set rows
  if (slot.prescriptions !== undefined && slot.prescriptions.length > 0) {
    const rows: SetTableRow[] = [];
    let globalIndex = 0;
    let warmupCount = 0;
    let workingCount = 0;

    const prescriptions = slot.prescriptions;
    const lastPrescriptionIndex = prescriptions.length - 1;

    for (let pIdx = 0; pIdx < prescriptions.length; pIdx++) {
      const entry = prescriptions[pIdx];
      const isWarmup = pIdx < lastPrescriptionIndex;
      const setCount = entry.sets;

      for (let s = 0; s < setCount; s++) {
        const isLastGlobal = pIdx === lastPrescriptionIndex && s === setCount - 1;
        const label = isWarmup ? `W${++warmupCount}` : `${++workingCount}`;

        rows.push({
          setIndex: globalIndex++,
          label,
          plannedWeight: noWeight ? undefined : entry.weight,
          plannedReps: entry.reps,
          isAmrap: slot.isAmrap && isLastGlobal,
          isWarmup,
        });
      }
    }

    return rows;
  }

  // Standard / GPP / bodyweight slots
  const rows: SetTableRow[] = [];
  for (let i = 0; i < slot.sets; i++) {
    rows.push({
      setIndex: i,
      label: `${i + 1}`,
      plannedWeight: noWeight ? undefined : slot.weight,
      plannedReps: slot.reps,
      isAmrap: slot.isAmrap && i === slot.sets - 1,
      isWarmup: false,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Per-row state for tracking user input
// ---------------------------------------------------------------------------

function initRepsInputs(tableRows: readonly SetTableRow[]): readonly string[] {
  return tableRows.map((row) => String(row.plannedReps));
}

// ---------------------------------------------------------------------------
// SlotTable sub-component (keeps the main component under control)
// ---------------------------------------------------------------------------

interface SlotTableProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly isCurrent: boolean;
  readonly onSetTap?: DayViewProps['onSetTap'];
  readonly onMark: DayViewProps['onMark'];
  readonly onUndo: DayViewProps['onUndo'];
  readonly onSetAmrapReps: DayViewProps['onSetAmrapReps'];
  readonly onSetRpe?: DayViewProps['onSetRpe'];
  readonly getSetLogs?: DayViewProps['getSetLogs'];
  readonly isSlotLogging?: DayViewProps['isSlotLogging'];
}

function SlotTable({
  slot,
  workoutIndex,
  isCurrent,
  onSetTap,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  getSetLogs,
  isSlotLogging,
}: SlotTableProps): ReactNode {
  const { t } = useTranslation();
  const isDone = slot.result !== undefined;
  const isGpp = slot.isGpp === true;
  const isBodyweight = slot.isBodyweight === true;
  const noWeight = isGpp || isBodyweight;

  const tableRows = buildSetRows(slot);

  // In-progress and committed set logs
  const inProgressLogs = getSetLogs?.(workoutIndex, slot.slotId);
  const committedLogs = slot.setLogs;
  const displayLogs = inProgressLogs ?? committedLogs;
  const logging = isSlotLogging?.(workoutIndex, slot.slotId) === true;

  // Local reps input state per row (weight is always read-only from the program)
  const [repsInputs, setRepsInputs] = useState<readonly string[]>(() => initRepsInputs(tableRows));

  const confirmedCount = displayLogs?.length ?? 0;

  const handleRepsChange = useCallback((rowIndex: number, value: string): void => {
    setRepsInputs((prev) => {
      const next = [...prev];
      next[rowIndex] = value;
      return next;
    });
  }, []);

  const handleConfirmSet = useCallback(
    (row: SetTableRow, rowIndex: number): void => {
      if (!onSetTap) return;
      const repsStr = repsInputs[rowIndex];
      if (repsStr === undefined) return;

      const reps = parseInt(repsStr, 10);
      if (Number.isNaN(reps)) return;

      onSetTap(workoutIndex, slot.slotId, row.setIndex, reps, row.plannedWeight);
    },
    [onSetTap, repsInputs, workoutIndex, slot.slotId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: SetTableRow, rowIndex: number): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmSet(row, rowIndex);
      }
    },
    [handleConfirmSet]
  );

  // Whether the slot is finished but the user never logged individual sets
  // (marked success/fail straight from the footer). In that case we still want
  // to show the prescribed reps rather than collapsing every cell to a dash.
  const doneWithoutLogs = isDone && confirmedCount === 0;
  const slotSucceeded = slot.result === 'success';

  return (
    <SlotCardShell slot={slot} isCurrent={isCurrent}>
      {/* Per-set table. On wide screens it is width-capped and left-aligned so the
          Kg / Reps columns sit beside Serie instead of stretching edge-to-edge. */}
      <div className="overflow-x-auto mb-3">
        <table
          className="w-full lg:max-w-md border-collapse"
          aria-label={t('tracker.detailed_day_view.table_aria', { exercise: slot.exerciseName })}
        >
          <colgroup>
            <col className="w-12" />
            <col />
            <col />
            <col />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-rule">
              <th className="text-2xs font-bold text-muted uppercase text-left py-1 pr-2">
                {t('tracker.detailed_day_view.col_set')}
              </th>
              <th className="text-2xs font-bold text-muted uppercase text-right py-1 px-2">
                {t('tracker.detailed_day_view.col_weight')}
              </th>
              <th className="text-2xs font-bold text-muted uppercase text-right py-1 px-2">
                {t('tracker.detailed_day_view.col_reps')}
              </th>
              <th className="text-2xs font-bold text-muted uppercase text-right py-1 px-2">
                {t('tracker.detailed_day_view.col_target')}
              </th>
              <th className="text-2xs font-bold text-muted uppercase text-center py-1 pl-2"> </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIndex) => {
              const isConfirmed = rowIndex < confirmedCount;
              const log = displayLogs?.[rowIndex];
              const isNextToConfirm = rowIndex === confirmedCount && !isDone;

              const metTarget = log !== undefined && log.reps >= row.plannedReps;
              // For a done-without-logs slot, colour the prescribed reps by the
              // slot-level result so the completed state still reads at a glance.
              const doneTone = slotSucceeded ? 'text-ok' : 'text-fail';

              const warmupClasses = row.isWarmup ? 'text-muted italic' : '';
              const amrapBorder = row.isAmrap ? 'border-l-2 border-accent' : '';
              const rowClasses = `${warmupClasses} ${amrapBorder}`;

              return (
                <tr key={row.setIndex} className={`border-b border-rule/50 ${rowClasses}`}>
                  {/* Set label */}
                  <td className="text-sm tabular-nums py-1.5 pr-2">
                    {row.label}
                    {row.isAmrap && <span className="text-accent font-bold ml-0.5">+</span>}
                  </td>

                  {/* Weight (read-only, from program) */}
                  <td className="text-sm tabular-nums text-right py-1.5 px-2">
                    {noWeight ? (
                      <span className="text-muted">{EM_DASH}</span>
                    ) : isConfirmed ? (
                      <span className={metTarget ? 'text-ok' : 'text-fail'}>
                        {row.plannedWeight}
                      </span>
                    ) : doneWithoutLogs ? (
                      <span className="text-muted">{row.plannedWeight ?? EM_DASH}</span>
                    ) : (
                      <span>{row.plannedWeight ?? EM_DASH}</span>
                    )}
                  </td>

                  {/* Reps (input — only thing the user enters) */}
                  <td className="text-sm tabular-nums text-right py-1.5 px-2">
                    {isConfirmed && log ? (
                      <span className={metTarget ? 'text-ok' : 'text-fail'}>{log.reps}</span>
                    ) : isDone && log ? (
                      <span className={log.reps >= row.plannedReps ? 'text-ok' : 'text-fail'}>
                        {log.reps}
                      </span>
                    ) : doneWithoutLogs ? (
                      // Keep prescribed reps visible after completion (greyed) rather
                      // than collapsing to a dash - the user did complete these.
                      <span className={`${doneTone} opacity-80`}>{row.plannedReps}</span>
                    ) : isDone ? (
                      <span className="text-muted">{EM_DASH}</span>
                    ) : (
                      <input
                        type="number"
                        value={repsInputs[rowIndex] ?? ''}
                        onChange={(e) => handleRepsChange(rowIndex, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, row, rowIndex)}
                        disabled={!isNextToConfirm && !isConfirmed}
                        placeholder={isNextToConfirm ? String(row.plannedReps) : ''}
                        aria-label={t('tracker.detailed_day_view.reps_input_aria', {
                          label: row.label,
                        })}
                        className="w-14 text-right text-sm tabular-nums bg-transparent border-b-2 border-rule focus:border-accent focus:bg-accent/5 outline-none py-1 transition-colors duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-30 placeholder:text-muted/40"
                      />
                    )}
                  </td>

                  {/* Target reps \u2014 fills the previously empty horizontal space */}
                  <td className="text-sm tabular-nums text-right py-1.5 px-2 text-muted">
                    {row.plannedReps}
                    {row.isAmrap ? '+' : ''}
                  </td>

                  {/* Confirm button */}
                  <td className="text-center py-1.5 pl-2">
                    {isConfirmed ? (
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold rounded-sm animate-[pop-in_0.2s_cubic-bezier(0.16,1,0.3,1)] ${metTarget ? 'text-ok bg-ok-bg' : 'text-fail bg-fail-bg'}`}
                        aria-label={t(
                          metTarget
                            ? 'tracker.detailed_day_view.set_completed_aria'
                            : 'tracker.detailed_day_view.set_failed_aria'
                        )}
                      >
                        {metTarget ? '\u2713' : '\u2717'}
                      </span>
                    ) : doneWithoutLogs ? (
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold rounded-sm ${slotSucceeded ? 'text-ok bg-ok-bg' : 'text-fail bg-fail-bg'}`}
                        aria-label={t(
                          slotSucceeded
                            ? 'tracker.detailed_day_view.set_completed_aria'
                            : 'tracker.detailed_day_view.set_failed_aria'
                        )}
                      >
                        {slotSucceeded ? '\u2713' : '\u2717'}
                      </span>
                    ) : isDone ? null : (
                      <button
                        type="button"
                        onClick={() => handleConfirmSet(row, rowIndex)}
                        disabled={!isNextToConfirm}
                        aria-label={t('tracker.detailed_day_view.confirm_set_aria', {
                          label: row.label,
                        })}
                        className="w-8 h-8 text-sm font-bold text-ok border-2 border-ok-ring bg-transparent cursor-pointer rounded-sm transition-all duration-150 hover:bg-ok-bg active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-30 disabled:cursor-default"
                      >
                        &#10003;
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: Result actions */}
      <SlotResultFooter
        slot={slot}
        workoutIndex={workoutIndex}
        isLogging={logging}
        onMark={onMark}
        onUndo={onUndo}
        onSetAmrapReps={onSetAmrapReps}
        onSetRpe={onSetRpe}
      />
    </SlotCardShell>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DetailedDayView({
  workout,
  isCurrent,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  onSetTap,
  getSetLogs,
  isSlotLogging,
}: DayViewProps): ReactNode {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col gap-3"
      aria-label={t('tracker.detailed_day_view.workout_aria', { number: workout.index + 1 })}
    >
      {workout.slots.map((slot) => (
        <SlotTable
          key={slot.slotId}
          slot={slot}
          workoutIndex={workout.index}
          isCurrent={isCurrent}
          onSetTap={onSetTap}
          onMark={onMark}
          onUndo={onUndo}
          onSetAmrapReps={onSetAmrapReps}
          onSetRpe={onSetRpe}
          getSetLogs={getSetLogs}
          isSlotLogging={isSlotLogging}
        />
      ))}
    </div>
  );
}
