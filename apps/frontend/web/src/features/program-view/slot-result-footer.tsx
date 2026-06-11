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
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: SlotResultFooterProps): ReactNode {
  const showRpe = slot.role === 'primary';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <ResultCell
        index={workoutIndex}
        tier={slot.slotId}
        result={slot.result}
        variant="card"
        isTestSlot={slot.isTestSlot === true}
        isSetLogging={isLogging}
        onMark={onMark}
        onUndo={onUndo}
      />

      {/* AMRAP input: shown when slot is AMRAP and has a success result, hidden when set logging is active */}
      {slot.result === 'success' && slot.isAmrap && !isLogging && slot.setLogs === undefined && (
        <AmrapInput
          value={slot.amrapReps}
          onChange={(reps) => onSetAmrapReps(workoutIndex, slot.slotId, reps)}
          variant="card"
          weight={slot.weight}
          result={slot.result}
        />
      )}

      {/* RPE select: shown for primary slots with a success result */}
      {slot.result === 'success' && showRpe && onSetRpe && (
        <RpeSelect
          value={slot.rpe}
          onChange={(rpe) => onSetRpe(workoutIndex, slot.slotId, rpe)}
          workoutIndex={workoutIndex}
          slotKey={slot.slotId}
        />
      )}

      {/* RPE display: shown for primary slots with non-success result but RPE already set */}
      {slot.result !== 'success' && slot.rpe !== undefined && (
        <span className="text-xs font-bold text-main">RPE {slot.rpe}</span>
      )}
    </div>
  );
}
