import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ResultValue,
  GenericWorkoutRow,
  GenericSlotRow,
  SetLogEntry,
} from '@gzclp/domain/types';
import { SetIndicators } from './set-indicators';
import { SlotCardShell } from './slot-card-shell';
import { SlotResultFooter } from './slot-result-footer';

/** All slot-level interaction callbacks, grouped for prop-drilling convenience. */
export interface SlotActions {
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
  /** Called when user confirms reps for a set via the inline stepper. */
  readonly onSetTap?: (
    workoutIndex: number,
    slotId: string,
    setIndex: number,
    reps: number,
    weight?: number,
    rpe?: number
  ) => void;
  /** Get in-progress set logs for a slot (from useSetLogging). */
  readonly getSetLogs?: (
    workoutIndex: number,
    slotId: string
  ) => readonly SetLogEntry[] | undefined;
  /** Check if set logging is in progress for a slot. */
  readonly isSlotLogging?: (workoutIndex: number, slotId: string) => boolean;
}

export interface DayViewProps {
  readonly workout: GenericWorkoutRow;
  readonly isCurrent: boolean;
  readonly onMark: SlotActions['onMark'];
  readonly onUndo: SlotActions['onUndo'];
  readonly onSetAmrapReps: SlotActions['onSetAmrapReps'];
  readonly onSetRpe?: SlotActions['onSetRpe'];
  readonly onSetTap?: SlotActions['onSetTap'];
  readonly getSetLogs?: SlotActions['getSetLogs'];
  readonly isSlotLogging?: SlotActions['isSlotLogging'];
}

/** Render prescription ladder: warm-ups -> working set separated by | */
function renderPrescriptionScheme(slot: GenericSlotRow): ReactNode {
  const prescriptions = slot.prescriptions;
  if (prescriptions === undefined || prescriptions.length === 0) {
    return null;
  }

  const warmups = prescriptions.slice(0, -1);
  const workingSet = prescriptions[prescriptions.length - 1];

  return (
    <div className="text-xs leading-relaxed">
      {warmups.map((entry, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-muted mx-0.5">{'\u2192'}</span>}
          <span className="text-muted">
            {`${entry.percent}%\u00d7${slot.complexReps ?? entry.reps}`}
          </span>
        </Fragment>
      ))}
      {warmups.length > 0 && <span className="text-muted mx-1">|</span>}
      <span className="font-bold text-main">
        {`${workingSet.percent}%\u00d7${slot.complexReps ?? workingSet.reps}\u00d7${workingSet.sets}`}
      </span>
    </div>
  );
}

/** Render standard scheme text: sets x reps with optional range and AMRAP */
function renderStandardScheme(slot: GenericSlotRow): ReactNode {
  return (
    <span className="text-xs font-semibold text-muted tabular-nums">
      {slot.sets}
      {'\u00d7'}
      {slot.complexReps ?? slot.reps}
      {slot.repsMax !== undefined ? `\u2013${slot.repsMax}` : ''}
      {slot.isAmrap && <span className="text-2xs ml-0.5 text-accent">+</span>}
    </span>
  );
}

export function DayView({
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
      aria-label={t('tracker.day_view.workout_aria', { number: workout.index + 1 })}
    >
      {workout.slots.map((slot) => {
        const isDone = slot.result !== undefined;
        const hasPrescriptions = slot.prescriptions !== undefined;
        const isGpp = slot.isGpp === true;
        const isBodyweight = slot.isBodyweight === true;

        return (
          <SlotCardShell key={slot.slotId} slot={slot} isCurrent={isCurrent}>
            {/* Row 2: Weight + Scheme */}
            <div className="flex items-baseline gap-3 mb-2.5">
              {/* Weight */}
              {isGpp || isBodyweight ? (
                <span className="text-sm font-bold text-muted tabular-nums">{'\u2014'}</span>
              ) : hasPrescriptions ? (
                <span className="text-sm font-bold text-main tabular-nums">
                  {`${slot.weight} kg`}
                  <span className="text-2xs text-muted ml-1">
                    {`(${slot.prescriptions[slot.prescriptions.length - 1].percent}%)`}
                  </span>
                </span>
              ) : (
                <span className="text-sm font-bold text-main tabular-nums">
                  {slot.weight > 0 ? `${slot.weight} kg` : '\u2014'}
                </span>
              )}

              {/* Scheme */}
              {hasPrescriptions ? renderPrescriptionScheme(slot) : renderStandardScheme(slot)}
            </div>

            {/* Row 3: Set indicators (standard slots only, not prescription/GPP) */}
            {!hasPrescriptions && !isGpp && (
              <div className="mb-3">
                <SetIndicators
                  sets={slot.sets}
                  result={slot.result}
                  isAmrap={slot.isAmrap}
                  targetReps={slot.reps}
                  setLogs={getSetLogs?.(workout.index, slot.slotId)}
                  committedSetLogs={slot.setLogs}
                  onSetTap={
                    onSetTap && !isDone
                      ? (setIndex, reps) => onSetTap(workout.index, slot.slotId, setIndex, reps)
                      : undefined
                  }
                />
              </div>
            )}

            {/* Row 4: Result action */}
            <SlotResultFooter
              slot={slot}
              workoutIndex={workout.index}
              isLogging={isSlotLogging?.(workout.index, slot.slotId) === true}
              onMark={onMark}
              onUndo={onUndo}
              onSetAmrapReps={onSetAmrapReps}
              onSetRpe={onSetRpe}
            />
          </SlotCardShell>
        );
      })}
    </div>
  );
}
