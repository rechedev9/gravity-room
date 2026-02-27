import type { ResultValue } from '@gzclp/shared/types';
import { ExerciseCard } from './exercise-card';

export interface DayViewSlot {
  readonly key: string;
  readonly exerciseName: string;
  readonly tierLabel: string;
  readonly role: 'primary' | 'secondary' | 'accessory';
  readonly weight: number;
  readonly scheme: string;
  readonly stage: number;
  readonly showStage: boolean;
  readonly isAmrap: boolean;
  readonly result: ResultValue | undefined;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
  readonly showRpe: boolean;
  readonly isChanged: boolean;
  readonly isDeload: boolean;
}

interface DayViewProps {
  readonly workoutIndex: number;
  readonly workoutNumber: number;
  readonly dayName: string;
  readonly isCurrent: boolean;
  readonly instanceId?: string;
  readonly slots: readonly DayViewSlot[];
  readonly onMark: (workoutIndex: number, slotKey: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotKey: string) => void;
  readonly onSetAmrapReps: (
    workoutIndex: number,
    slotKey: string,
    reps: number | undefined
  ) => void;
  readonly onSetRpe?: (workoutIndex: number, slotKey: string, rpe: number | undefined) => void;
}

export function DayView({
  workoutIndex,
  workoutNumber,
  dayName,
  isCurrent,
  instanceId,
  slots,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: DayViewProps): React.ReactNode {
  return (
    <div
      className="animate-[card-enter_0.15s_ease-out]"
      {...(isCurrent ? { 'data-current-row': true } : {})}
    >
      {/* Day header */}
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-display text-3xl text-heading">#{workoutNumber}</span>
        <span className="font-mono text-[11px] font-bold text-muted uppercase tracking-widest">
          {dayName}
        </span>
      </div>

      {/* Exercise cards */}
      <div className="flex flex-col gap-3">
        {slots.map((slot) => (
          <ExerciseCard
            key={slot.key}
            workoutIndex={workoutIndex}
            slotKey={slot.key}
            exerciseName={slot.exerciseName}
            tierLabel={slot.tierLabel}
            role={slot.role}
            weight={slot.weight}
            scheme={slot.scheme}
            stage={slot.stage}
            showStage={slot.showStage}
            isAmrap={slot.isAmrap}
            result={slot.result}
            amrapReps={slot.amrapReps}
            rpe={slot.rpe}
            showRpe={slot.showRpe}
            isChanged={slot.isChanged}
            isDeload={slot.isDeload}
            instanceId={instanceId}
            onMark={onMark}
            onUndo={onUndo}
            onSetAmrapReps={slot.isAmrap ? onSetAmrapReps : undefined}
            onSetRpe={slot.showRpe ? onSetRpe : undefined}
          />
        ))}
      </div>
    </div>
  );
}
