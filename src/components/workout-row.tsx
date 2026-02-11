'use client';

import { NAMES } from '@/lib/program';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@/types';
import { StageTag } from './stage-tag';

interface WorkoutRowProps {
  row: WorkoutRowType;
  isCurrent: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
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
        className={`group relative inline-block px-3.5 py-1.5 text-[13px] font-extrabold cursor-pointer transition-transform hover:scale-110 border-3 ${
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
        className="px-3.5 py-2 text-sm font-extrabold border-3 border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--btn-text)] cursor-pointer transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]"
      >
        &#10003;
      </button>
      <button
        onClick={() => onMark(index, tier, 'fail')}
        className="px-3.5 py-2 text-sm font-extrabold border-3 border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--btn-text)] cursor-pointer transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]"
      >
        &#10007;
      </button>
    </div>
  );
}

export function WorkoutRow({ row, isCurrent, onMark, onUndo }: WorkoutRowProps) {
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
      </td>
    </tr>
  );
}
