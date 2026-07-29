import type { ReactNode } from 'react';
import type { GenericSlotRow } from '@gzclp/domain/types';
import type { DayViewProps } from './day-view';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeSelect } from './rpe-select';

export interface SlotResultFooterProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  /** Whether set-logging is currently active for this slot. */
  readonly isLogging: boolean;
  /**
   * Set-first mode (detailed day view): hide slot-level pass/fail while the
   * slot is still open so the user has one primary action — confirm each set.
   * Compact / slot-first mode keeps the quick ✓/✗ shortcut.
   */
  readonly setFirstMode?: boolean;
  readonly onMark: DayViewProps['onMark'];
  readonly onUndo: DayViewProps['onUndo'];
  readonly onSetAmrapReps: DayViewProps['onSetAmrapReps'];
  readonly onSetRpe?: DayViewProps['onSetRpe'];
}

/**
 * Shared result-action footer rendered at the bottom of every slot card in
 * both DayView and DetailedDayView.  Contains the ResultCell, optional
 * AmrapInput, optional RpeSelect, and the RPE display span.
 */
export function SlotResultFooter({
  slot,
  workoutIndex,
  isLogging,
  setFirstMode = false,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: SlotResultFooterProps): ReactNode {
  const showRpe = slot.role === 'primary';
  const isTestSlot = slot.isTestSlot === true;
  // In set-first mode, only surface ResultCell when there is something to undo
  // (result already committed) or for test slots that still use a single CTA.
  const showResultCell = !setFirstMode || slot.result !== undefined || isTestSlot;
  const showAmrap =
    slot.result === 'success' && slot.isAmrap && !isLogging && slot.setLogs === undefined;
  const showRpeSelect = slot.result === 'success' && showRpe && onSetRpe !== undefined;
  const showRpeDisplay = slot.result !== 'success' && slot.rpe !== undefined;

  if (!showResultCell && !showAmrap && !showRpeSelect && !showRpeDisplay) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {showResultCell ? (
        <ResultCell
          index={workoutIndex}
          tier={slot.slotId}
          exerciseName={slot.exerciseName}
          tierLabel={slot.tier.toUpperCase()}
          result={slot.result}
          variant="card"
          isTestSlot={isTestSlot}
          isSetLogging={isLogging}
          onMark={onMark}
          onUndo={onUndo}
        />
      ) : null}

      {showAmrap ? (
        <AmrapInput
          value={slot.amrapReps}
          onChange={(reps) => onSetAmrapReps(workoutIndex, slot.slotId, reps)}
          variant="card"
          weight={slot.weight}
          result={slot.result}
        />
      ) : null}

      {showRpeSelect && onSetRpe ? (
        <RpeSelect
          value={slot.rpe}
          onChange={(rpe) => onSetRpe(workoutIndex, slot.slotId, rpe)}
          workoutIndex={workoutIndex}
          slotKey={slot.slotId}
        />
      ) : null}

      {showRpeDisplay ? <span className="text-xs font-bold text-main">RPE {slot.rpe}</span> : null}
    </div>
  );
}
