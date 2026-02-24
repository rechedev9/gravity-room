import { memo, useCallback, useMemo } from 'react';
import type { GenericWorkoutRow, GenericSlotRow, ResultValue } from '@gzclp/shared/types';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeInput } from './rpe-input';

interface GenericWorkoutCardProps {
  readonly row: GenericWorkoutRow;
  readonly isCurrent: boolean;
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
}

const TIER_STYLES: Readonly<Record<string, string>> = {
  t1: 'text-[var(--fill-progress)]',
  t2: 'text-[var(--text-main)]',
  t3: 'text-[var(--text-muted)]',
};

/**
 * SlotSection renders a single slot within a workout card.
 *
 * Because ResultCell expects (index, tier) callbacks and a day may contain
 * multiple slots with the same tier, we capture the specific slotId in wrapper
 * callbacks passed to ResultCell. The tier parameter from ResultCell is ignored.
 */
function SlotSection({
  slot,
  workoutIndex,
  onSlotMark,
  onSetAmrapReps,
  onSetRpe,
  onSlotUndo,
}: {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly onSlotMark: (index: number, tier: string, value: ResultValue) => void;
  readonly onSetAmrapReps?: (reps: number | undefined) => void;
  readonly onSetRpe?: (rpe: number | undefined) => void;
  readonly onSlotUndo: (index: number, tier: string) => void;
}): React.ReactNode {
  const tierLabel = slot.tier.toUpperCase();
  const tierStyle = TIER_STYLES[slot.tier] ?? '';

  return (
    <div className="py-2 border-b border-[var(--border-light)] last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-bold uppercase ${tierStyle}`}>{tierLabel}</div>
          <div className="text-[13px] font-bold truncate">{slot.exerciseName}</div>
        </div>
        <div className="text-center shrink-0">
          {slot.weight > 0 && (
            <div
              className={
                slot.role === 'primary'
                  ? 'font-display-data text-3xl text-[var(--fill-progress)] tabular-nums'
                  : slot.role === 'accessory'
                    ? 'text-[15px] font-extrabold tabular-nums text-[var(--text-muted)]'
                    : 'text-[15px] font-extrabold tabular-nums'
              }
            >
              {slot.weight} kg
            </div>
          )}
          <div className="text-[12px] font-semibold text-[var(--text-muted)]">
            {slot.sets}&times;{slot.reps}
            {slot.repsMax !== undefined && `-${slot.repsMax}`}
            {slot.isAmrap && (
              <span className="text-[10px] ml-1 text-[var(--fill-progress)]">AMRAP</span>
            )}
            {slot.stage > 0 && (
              <>
                {' '}
                <StageTag stage={slot.stage} size="md" />
              </>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <ResultCell
            index={workoutIndex}
            tier={slot.tier}
            result={slot.result}
            variant="card"
            onMark={onSlotMark}
            onUndo={onSlotUndo}
          />
        </div>
      </div>
      {/* fix: AMRAP only shows for success results */}
      {slot.result === 'success' && slot.isAmrap && onSetAmrapReps && (
        <div className="mt-1.5 flex items-center gap-2 pl-1">
          <span className="text-[10px] text-[var(--text-muted)]">Rep. AMRAP:</span>
          <AmrapInput value={slot.amrapReps} onChange={onSetAmrapReps} variant="card" />
        </div>
      )}
      {/* fix: RPE only for success primary-role slots */}
      {slot.result === 'success' && slot.role === 'primary' && onSetRpe && (
        <div className="mt-1 pl-1" data-rpe-input={`${workoutIndex}-${slot.slotId}`}>
          <RpeInput value={slot.rpe} onChange={onSetRpe} label={slot.tier.toUpperCase()} />
        </div>
      )}
    </div>
  );
}

function areCardsEqual(prev: GenericWorkoutCardProps, next: GenericWorkoutCardProps): boolean {
  if (prev.isCurrent !== next.isCurrent) return false;
  const p = prev.row;
  const n = next.row;
  if (p.index !== n.index || p.isChanged !== n.isChanged) return false;
  if (p.slots.length !== n.slots.length) return false;
  for (let i = 0; i < p.slots.length; i++) {
    const ps = p.slots[i];
    const ns = n.slots[i];
    if (
      ps.weight !== ns.weight ||
      ps.stage !== ns.stage ||
      ps.sets !== ns.sets ||
      ps.reps !== ns.reps ||
      ps.repsMax !== ns.repsMax ||
      ps.role !== ns.role ||
      ps.result !== ns.result ||
      ps.amrapReps !== ns.amrapReps ||
      ps.rpe !== ns.rpe ||
      ps.isChanged !== ns.isChanged
    ) {
      return false;
    }
  }
  return true;
}

export const GenericWorkoutCard = memo(function GenericWorkoutCard({
  row,
  isCurrent,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: GenericWorkoutCardProps) {
  const allDone = row.slots.every((s) => s.result !== undefined);

  // Wrapper callbacks that capture the slotId for each slot.
  // ResultCell calls back with (index, tier, value) but we route to (index, slotId, value).
  const slotCallbacks = useMemo(
    () =>
      row.slots.map((slot) => ({
        mark: (_index: number, _tier: string, value: ResultValue): void => {
          onMark(row.index, slot.slotId, value);
        },
        undo: (): void => {
          onUndo(row.index, slot.slotId);
        },
      })),
    [row.slots, row.index, onMark, onUndo]
  );

  const handleAmrapReps = useCallback(
    (slotId: string, reps: number | undefined): void => {
      onSetAmrapReps(row.index, slotId, reps);
    },
    [onSetAmrapReps, row.index]
  );

  const handleRpe = useCallback(
    (slotId: string, rpe: number | undefined): void => {
      onSetRpe?.(row.index, slotId, rpe);
    },
    [onSetRpe, row.index]
  );

  return (
    <div
      {...(isCurrent ? { 'data-current-row': true } : {})}
      className={`bg-[var(--bg-card)] border border-[var(--border-color)] p-3 sm:p-4 mb-3 ${
        allDone ? 'opacity-40' : ''
      } ${isCurrent ? 'border-l-4 border-l-[var(--fill-progress)]' : ''} ${
        row.isChanged && !allDone ? 'bg-[var(--bg-changed)]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-2xl">#{row.index + 1}</span>
        <span className="text-xs font-semibold text-[var(--text-muted)]">{row.dayName}</span>
      </div>

      {row.slots.map((slot, i) => (
        <SlotSection
          key={slot.slotId}
          slot={slot}
          workoutIndex={row.index}
          onSlotMark={slotCallbacks[i].mark}
          onSlotUndo={slotCallbacks[i].undo}
          onSetAmrapReps={
            slot.isAmrap
              ? (reps: number | undefined) => handleAmrapReps(slot.slotId, reps)
              : undefined
          }
          onSetRpe={
            slot.role === 'primary' && onSetRpe
              ? (rpe: number | undefined) => handleRpe(slot.slotId, rpe)
              : undefined
          }
        />
      ))}
    </div>
  );
}, areCardsEqual);
