import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { ResultValue, GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeSelect } from './rpe-select';
import { StageTag } from './stage-tag';
import { SetIndicators } from './set-indicators';

interface DayViewProps {
  readonly workout: GenericWorkoutRow;
  readonly isCurrent: boolean;
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
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

/** Tier badge color based on role */
function tierColorClass(role: GenericSlotRow['role']): string {
  if (role === 'primary') return 'text-accent';
  if (role === 'secondary') return 'text-main';
  return 'text-muted';
}

export function DayView({
  workout,
  isCurrent,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: DayViewProps): ReactNode {
  return (
    <div className="flex flex-col gap-3" aria-label={`Entrenamiento ${workout.index + 1}`}>
      {workout.slots.map((slot) => {
        const isDone = slot.result !== undefined;
        const needsAmrap =
          slot.result === 'success' && slot.isAmrap && slot.amrapReps === undefined;
        const fullyDone = isDone && !needsAmrap;
        const hasPrescriptions = slot.prescriptions !== undefined;
        const isGpp = slot.isGpp === true;
        const isBodyweight = slot.isBodyweight === true;
        const showStage = slot.stagesCount > 1 && !hasPrescriptions && !isGpp;
        const showRpe = slot.role === 'primary';

        return (
          <div
            key={slot.slotId}
            className={`border border-rule bg-card px-4 py-3.5 transition-opacity duration-200 ${
              fullyDone ? 'opacity-70' : ''
            } ${isCurrent && !fullyDone ? 'accent-left-gold' : 'accent-left-muted'} ${
              slot.isChanged && !isDone ? 'bg-changed' : ''
            }`}
            style={{ animation: 'card-enter 0.2s ease-out' }}
          >
            {/* Row 1: Tier + Exercise + Stage */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold uppercase tracking-widest font-mono ${tierColorClass(slot.role)}`}
              >
                {slot.tier.toUpperCase()}
              </span>
              <span className="font-bold text-sm text-main truncate">{slot.exerciseName}</span>
              {showStage && slot.stage > 0 && <StageTag stage={slot.stage} size="sm" />}
              {slot.isDeload && (
                <span className="text-2xs font-bold text-muted tracking-wider uppercase font-mono">
                  {'\u2193'} Deload
                </span>
              )}
            </div>

            {/* Notes */}
            {slot.notes !== undefined && <p className="text-xs text-muted mb-1.5">{slot.notes}</p>}

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
                <SetIndicators sets={slot.sets} result={slot.result} isAmrap={slot.isAmrap} />
              </div>
            )}

            {/* Row 4: Result action */}
            <div className="flex items-center gap-3 flex-wrap">
              <ResultCell
                index={workout.index}
                tier={slot.slotId}
                result={slot.result}
                variant="card"
                isTestSlot={slot.isTestSlot === true}
                onMark={onMark}
                onUndo={onUndo}
              />

              {/* AMRAP input: shown when slot is AMRAP and has a success result */}
              {slot.result === 'success' && slot.isAmrap && (
                <AmrapInput
                  value={slot.amrapReps}
                  onChange={(reps) => onSetAmrapReps(workout.index, slot.slotId, reps)}
                  variant="card"
                  weight={slot.weight}
                  result={slot.result}
                />
              )}

              {/* RPE select: shown for primary slots with a success result */}
              {slot.result === 'success' && showRpe && onSetRpe && (
                <RpeSelect
                  value={slot.rpe}
                  onChange={(rpe) => onSetRpe(workout.index, slot.slotId, rpe)}
                  workoutIndex={workout.index}
                  slotKey={slot.slotId}
                />
              )}

              {/* RPE display: shown for primary slots with non-success result but RPE already set */}
              {slot.result !== 'success' && slot.rpe !== undefined && (
                <span className="text-xs font-bold text-main">RPE {slot.rpe}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
