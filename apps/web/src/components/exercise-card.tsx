import { useState } from 'react';
import type { ResultValue } from '@gzclp/shared/types';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeInput } from './rpe-input';
import { PlateCalculator } from './plate-calculator';
import { WorkoutNotes } from './workout-notes';

export interface ExerciseCardProps {
  readonly workoutIndex: number;
  readonly slotKey: string;
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
  readonly instanceId?: string;
  readonly onMark: (index: number, key: string, value: ResultValue) => void;
  readonly onUndo: (index: number, key: string) => void;
  readonly onSetAmrapReps?: (
    workoutIndex: number,
    slotKey: string,
    reps: number | undefined
  ) => void;
  readonly onSetRpe?: (workoutIndex: number, slotKey: string, rpe: number | undefined) => void;
}

const ROLE_STYLES = {
  primary: {
    tierColor: 'text-[var(--fill-progress)]',
    nameSize: 'text-base',
    weightStyle: 'font-display-data text-3xl text-[var(--fill-progress)] tabular-nums',
  },
  secondary: {
    tierColor: 'text-[var(--text-main)]',
    nameSize: 'text-sm',
    weightStyle: 'text-lg font-extrabold tabular-nums',
  },
  accessory: {
    tierColor: 'text-[var(--text-muted)]',
    nameSize: 'text-sm',
    weightStyle: 'text-base font-extrabold tabular-nums text-[var(--text-muted)]',
  },
} as const;

export function ExerciseCard({
  workoutIndex,
  slotKey,
  exerciseName,
  tierLabel,
  role,
  weight,
  scheme,
  stage,
  showStage,
  isAmrap,
  result,
  amrapReps,
  rpe,
  showRpe,
  isChanged,
  isDeload,
  instanceId,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: ExerciseCardProps): React.ReactNode {
  const styles = ROLE_STYLES[role];
  const [pcOpen, setPcOpen] = useState(false);
  const showPlateCalc = role === 'primary' && weight > 0;

  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border-color)] p-4 card transition-all duration-200 ${
        role === 'primary' ? 'accent-left-gold' : role === 'secondary' ? 'accent-left-muted' : ''
      } ${
        result !== undefined ? 'opacity-55 saturate-50' : ''
      } ${isChanged && result === undefined ? 'bg-[var(--bg-changed)]' : ''}`}
    >
      {/* Tier · Exercise name */}
      <div className="flex items-center gap-2">
        <span className={`text-[12px] font-bold uppercase ${styles.tierColor}`}>{tierLabel}</span>
        <span className="text-[11px] text-[var(--text-muted)]">&middot;</span>
        <span className={`font-bold truncate ${styles.nameSize}`}>{exerciseName}</span>
      </div>

      {/* Weight · Scheme · Stage */}
      <div className="flex items-baseline gap-2 mt-1">
        {weight > 0 && (
          <span className="relative">
            {showPlateCalc ? (
              <button
                onClick={() => setPcOpen((v) => !v)}
                aria-label="Calculadora de discos"
                className={`${styles.weightStyle} cursor-pointer underline decoration-dotted underline-offset-4`}
              >
                {weight} kg
              </button>
            ) : (
              <span className={styles.weightStyle}>{weight} kg</span>
            )}
            {isDeload && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">{'\u2193'} Deload</span>
            )}
            {pcOpen && (
              <PlateCalculator weight={weight} isOpen={pcOpen} onClose={() => setPcOpen(false)} />
            )}
          </span>
        )}
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">
          {scheme}
          {isAmrap && <span className="text-[10px] ml-1 text-[var(--fill-progress)]">AMRAP</span>}
        </span>
        {showStage && stage > 0 && <StageTag stage={stage} size="md" />}
      </div>

      {/* Result buttons / badge */}
      <div className="mt-3">
        <ResultCell
          index={workoutIndex}
          tier={slotKey}
          result={result}
          variant="card"
          onMark={onMark}
          onUndo={onUndo}
        />
      </div>

      {/* AMRAP input (success only) */}
      {result === 'success' && isAmrap && onSetAmrapReps && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Rep. AMRAP:</span>
          <AmrapInput
            value={amrapReps}
            onChange={(reps: number | undefined) => onSetAmrapReps(workoutIndex, slotKey, reps)}
            variant="card"
            weight={weight}
            result={result}
          />
        </div>
      )}

      {/* RPE input (success only, primary/showRpe slots) */}
      {result === 'success' && showRpe && onSetRpe && (
        <div className="mt-1.5" data-rpe-input={`${workoutIndex}-${slotKey}`}>
          <RpeInput
            value={rpe}
            onChange={(rpeVal: number | undefined) => onSetRpe(workoutIndex, slotKey, rpeVal)}
            label={tierLabel}
          />
        </div>
      )}

      {/* Workout notes (local-only, when instanceId is available) */}
      {instanceId !== undefined && (
        <WorkoutNotes instanceId={instanceId} workoutIndex={workoutIndex} slotKey={slotKey} />
      )}
    </div>
  );
}
