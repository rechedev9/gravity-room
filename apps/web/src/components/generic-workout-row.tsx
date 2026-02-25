import { memo, useCallback, useMemo } from 'react';
import type { GenericWorkoutRow as GenericWorkoutRowType, ResultValue } from '@gzclp/shared/types';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeInput } from './rpe-input';

const TIER_STYLES: Readonly<Record<string, string>> = {
  t1: 'text-[var(--fill-progress)]',
  t2: 'text-[var(--text-main)]',
  t3: 'text-[var(--text-muted)]',
};

interface GenericWorkoutRowProps {
  readonly row: GenericWorkoutRowType;
  readonly maxSlots: number;
  readonly isCurrent: boolean;
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
}

function areRowsEqual(prev: GenericWorkoutRowProps, next: GenericWorkoutRowProps): boolean {
  if (prev.isCurrent !== next.isCurrent || prev.maxSlots !== next.maxSlots) return false;
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

export const GenericWorkoutRow = memo(function GenericWorkoutRow({
  row,
  maxSlots,
  isCurrent,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: GenericWorkoutRowProps): React.ReactNode {
  const allDone = row.slots.every((s) => s.result !== undefined);
  const totalColumns = 2 + maxSlots * 3;

  // Slots that have AMRAP/RPE data to show in sub-rows
  const detailSlots = row.slots.filter((s) => {
    if (s.result !== 'success') return false;
    const hasAmrap = s.isAmrap;
    const hasRpe = s.role === 'primary' && onSetRpe !== undefined;
    const hasEnteredData = s.amrapReps !== undefined || s.rpe !== undefined;
    return (hasAmrap || hasRpe) && (!allDone || hasEnteredData);
  });

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

  const rowClasses = [
    'transition-colors',
    allDone ? 'opacity-40 hover:opacity-70' : '',
    isCurrent ? 'border-l-4 border-l-[var(--fill-progress)]' : '',
    row.isChanged && !allDone ? '[&>td]:!bg-[var(--bg-changed)]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Build empty cells for slots beyond this row's actual count
  const emptyCells: React.ReactNode[] = [];
  for (let i = row.slots.length; i < maxSlots; i++) {
    emptyCells.push(
      <td key={`empty-ex-${i}`} className="border border-[var(--border-light)] px-2 py-3" />,
      <td key={`empty-kg-${i}`} className="border border-[var(--border-light)] px-2 py-3" />,
      <td key={`empty-res-${i}`} className="border border-[var(--border-light)] px-2 py-3" />
    );
  }

  return (
    <>
      <tr
        {...(isCurrent ? { 'data-current-row': true } : {})}
        className={`${rowClasses} hover:bg-[var(--bg-hover-row)]`}
      >
        {/* # */}
        <td className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums">
          {row.index + 1}
        </td>
        {/* Día */}
        <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-xs text-[var(--text-muted)]">
          {row.dayName}
        </td>
        {/* Slot cells */}
        {row.slots.map((slot, i) => (
          <SlotCells
            key={slot.slotId}
            slot={slot}
            workoutIndex={row.index}
            callbacks={slotCallbacks[i]}
          />
        ))}
        {emptyCells}
      </tr>
      {/* AMRAP/RPE sub-rows */}
      {detailSlots.length > 0 && (
        <tr className={rowClasses}>
          <td
            colSpan={totalColumns}
            className="border-x border-b border-[var(--border-light)] px-4 py-1"
          >
            <div className="flex items-center gap-4 flex-wrap">
              {detailSlots.map((slot) => (
                <DetailInputs
                  key={slot.slotId}
                  slot={slot}
                  workoutIndex={row.index}
                  onAmrap={(reps) => handleAmrapReps(slot.slotId, reps)}
                  onRpe={onSetRpe ? (rpe) => handleRpe(slot.slotId, rpe) : undefined}
                />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}, areRowsEqual);

// --- Private sub-components ---

interface SlotCellsProps {
  readonly slot: GenericWorkoutRowType['slots'][number];
  readonly workoutIndex: number;
  readonly callbacks: {
    readonly mark: (i: number, t: string, v: ResultValue) => void;
    readonly undo: () => void;
  };
}

function SlotCells({ slot, workoutIndex, callbacks }: SlotCellsProps): React.ReactNode {
  const tierStyle = TIER_STYLES[slot.tier] ?? '';

  return (
    <>
      {/* Exercise name + tier badge */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle">
        <div className={`text-[11px] font-bold uppercase ${tierStyle}`}>
          {slot.tier.toUpperCase()}
        </div>
        <div className="text-[13px] font-bold truncate max-w-[140px]">{slot.exerciseName}</div>
      </td>
      {/* KG + Scheme */}
      <td className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle">
        <div className="font-extrabold text-[15px] tabular-nums">
          {slot.weight > 0 ? `${slot.weight}` : '—'}
        </div>
        <div className="text-xs text-[var(--text-muted)] font-semibold">
          {slot.sets}&times;{slot.reps}
          {slot.repsMax !== undefined && `-${slot.repsMax}`}
          {slot.isAmrap && (
            <span className="text-[10px] ml-0.5 text-[var(--fill-progress)]">+</span>
          )}
          {slot.stage > 0 && (
            <>
              {' '}
              <StageTag stage={slot.stage} size="sm" />
            </>
          )}
        </div>
      </td>
      {/* Result */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle">
        <ResultCell
          index={workoutIndex}
          tier={slot.tier}
          result={slot.result}
          variant="table"
          onMark={callbacks.mark}
          onUndo={callbacks.undo}
        />
      </td>
    </>
  );
}

interface DetailInputsProps {
  readonly slot: GenericWorkoutRowType['slots'][number];
  readonly workoutIndex: number;
  readonly onAmrap: (reps: number | undefined) => void;
  readonly onRpe: ((rpe: number | undefined) => void) | undefined;
}

function DetailInputs({ slot, workoutIndex, onAmrap, onRpe }: DetailInputsProps): React.ReactNode {
  return (
    <>
      {slot.isAmrap && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
            {slot.exerciseName} AMRAP
          </span>
          <AmrapInput value={slot.amrapReps} onChange={onAmrap} />
        </div>
      )}
      {slot.role === 'primary' && onRpe && (
        <div className="flex items-center gap-2" data-rpe-input={`${workoutIndex}-${slot.slotId}`}>
          <RpeInput value={slot.rpe} onChange={onRpe} label={slot.exerciseName} />
        </div>
      )}
    </>
  );
}
