'use client';

import { NAMES } from '@/lib/program';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@/types';
import { StageTag } from './stage-tag';

interface WorkoutRowProps {
  row: WorkoutRowType;
  isCurrent: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onSetAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  onUndo: (index: number, tier: Tier) => void;
}

function ResultCell({
  index,
  tier,
  result,
  onMark,
  onUndo,
}: {
  index: number;
  tier: Tier;
  result?: ResultValue;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onUndo: (index: number, tier: Tier) => void;
}) {
  if (result) {
    const isSuccess = result === 'success';
    return (
      <button
        onClick={() => onUndo(index, tier)}
        className={`group relative inline-block px-3.5 py-1.5 text-[13px] font-extrabold cursor-pointer transition-transform hover:scale-110 border-3 rounded-sm ${
          isSuccess
            ? 'bg-[var(--bg-badge-ok)] border-[var(--border-badge-ok)] text-[var(--text-badge-ok)]'
            : 'bg-[var(--bg-badge-no)] border-[var(--border-badge-no)] text-[var(--text-badge-no)]'
        }`}
      >
        {isSuccess ? '\u2713' : '\u2717'}
        <span className="absolute -top-5.5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap bg-[var(--bg-tooltip)] text-[var(--text-tooltip)] px-2 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          undo
        </span>
      </button>
    );
  }

  return (
    <div className="flex gap-1 justify-center">
      <button
        onClick={() => onMark(index, tier, 'success')}
        className="px-3.5 py-2 text-sm font-extrabold border-2 border-[var(--border-badge-ok)] bg-transparent text-[var(--text-badge-ok)] rounded-sm cursor-pointer transition-all hover:bg-[var(--bg-badge-ok)]"
      >
        &#10003;
      </button>
      <button
        onClick={() => onMark(index, tier, 'fail')}
        className="px-3.5 py-2 text-sm font-extrabold border-2 border-[var(--border-badge-no)] bg-transparent text-[var(--text-badge-no)] rounded-sm cursor-pointer transition-all hover:bg-[var(--bg-badge-no)]"
      >
        &#10007;
      </button>
    </div>
  );
}

function AmrapInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (reps: number | undefined) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      max="99"
      placeholder="—"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0));
      }}
      className="w-10 px-1 py-0.5 text-center text-[11px] font-bold bg-transparent border border-[var(--border-color)] text-[var(--text-main)] focus:border-[var(--fill-progress)] focus:outline-none tabular-nums"
      title="AMRAP reps"
    />
  );
}

export function WorkoutRow({ row, isCurrent, onMark, onSetAmrapReps, onUndo }: WorkoutRowProps) {
  const allDone = row.result.t1 && row.result.t2 && row.result.t3;

  const rowClasses = [
    'transition-colors',
    allDone ? 'opacity-40 hover:opacity-70' : '',
    isCurrent ? 'border-l-4 border-l-[var(--fill-progress)]' : '',
    row.isChanged && !allDone ? '[&>td]:!bg-[var(--bg-changed)]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      {...(isCurrent ? { 'data-current-row': true } : {})}
      className={`${rowClasses} hover:bg-[var(--bg-hover-row)]`}
    >
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px]">
        {row.index + 1}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-xs text-[var(--text-muted)]">
        {row.dayName}
      </td>
      {/* T1 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t1Exercise]}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums">
        {row.t1Weight}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-[13px]">
        {row.t1Sets}&times;{row.t1Reps}
        <br />
        <StageTag stage={row.t1Stage} size="md" />
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle">
        <ResultCell
          index={row.index}
          tier="t1"
          result={row.result.t1}
          onMark={onMark}
          onUndo={onUndo}
        />
        {row.result.t1 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">AMRAP</span>
            <AmrapInput
              value={row.result.t1Reps}
              onChange={(reps) => onSetAmrapReps(row.index, 't1Reps', reps)}
            />
          </div>
        )}
      </td>
      {/* T2 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t2Exercise]}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums">
        {row.t2Weight}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-[13px]">
        {row.t2Sets}&times;{row.t2Reps}
        <br />
        <StageTag stage={row.t2Stage} size="md" />
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle">
        <ResultCell
          index={row.index}
          tier="t2"
          result={row.result.t2}
          onMark={onMark}
          onUndo={onUndo}
        />
      </td>
      {/* T3 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t3Exercise]}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums">
        {row.t3Weight}
        <br />
        <span className="text-[10px] text-[var(--text-muted)] font-normal">3&times;15</span>
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle">
        <ResultCell
          index={row.index}
          tier="t3"
          result={row.result.t3}
          onMark={onMark}
          onUndo={onUndo}
        />
        {row.result.t3 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">AMRAP</span>
            <AmrapInput
              value={row.result.t3Reps}
              onChange={(reps) => onSetAmrapReps(row.index, 't3Reps', reps)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
