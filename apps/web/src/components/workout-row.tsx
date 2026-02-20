import { memo, useCallback } from 'react';
import { NAMES } from '@gzclp/shared/program';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@gzclp/shared/types';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';

interface WorkoutRowProps {
  row: WorkoutRowType;
  isCurrent: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onSetAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  onUndo: (index: number, tier: Tier) => void;
}

function areRowsEqual(prev: WorkoutRowProps, next: WorkoutRowProps): boolean {
  if (prev.isCurrent !== next.isCurrent) return false;

  const p = prev.row;
  const n = next.row;

  return (
    p.index === n.index &&
    p.t1Weight === n.t1Weight &&
    p.t1Stage === n.t1Stage &&
    p.t1Sets === n.t1Sets &&
    p.t1Reps === n.t1Reps &&
    p.t2Weight === n.t2Weight &&
    p.t2Stage === n.t2Stage &&
    p.t2Sets === n.t2Sets &&
    p.t2Reps === n.t2Reps &&
    p.t3Weight === n.t3Weight &&
    p.isChanged === n.isChanged &&
    p.result.t1 === n.result.t1 &&
    p.result.t2 === n.result.t2 &&
    p.result.t3 === n.result.t3 &&
    p.result.t1Reps === n.result.t1Reps &&
    p.result.t3Reps === n.result.t3Reps
  );
}

export const WorkoutRow = memo(function WorkoutRow({
  row,
  isCurrent,
  onMark,
  onSetAmrapReps,
  onUndo,
}: WorkoutRowProps) {
  const allDone = row.result.t1 && row.result.t2 && row.result.t3;

  const handleT1AmrapChange = useCallback(
    (reps: number | undefined) => onSetAmrapReps(row.index, 't1Reps', reps),
    [onSetAmrapReps, row.index]
  );

  const handleT3AmrapChange = useCallback(
    (reps: number | undefined) => onSetAmrapReps(row.index, 't3Reps', reps),
    [onSetAmrapReps, row.index]
  );

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
      <td className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums">
        {row.index + 1}
        {!allDone && (
          <a
            href={buildGoogleCalendarUrl(row).calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
            className="font-mono block text-[10px] text-[var(--text-muted)] hover:text-[var(--fill-progress)] transition-colors leading-none mt-0.5"
          >
            ↗ Cal
          </a>
        )}
      </td>
      <td className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-xs text-[var(--text-muted)]">
        {row.dayName}
      </td>
      {/* T1 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t1Exercise]}
      </td>
      <td
        data-testid={`t1-weight-${row.index}`}
        className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums"
      >
        {row.t1Weight}
      </td>
      <td
        data-testid={`t1-scheme-${row.index}`}
        className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-[13px]"
      >
        {row.t1Sets}&times;{row.t1Reps}
        <br />
        <StageTag stage={row.t1Stage} size="md" />
      </td>
      <td
        data-testid={`t1-result-${row.index}`}
        className="border border-[var(--border-light)] px-2 py-3 text-center align-middle"
      >
        <ResultCell
          index={row.index}
          tier="t1"
          result={row.result.t1}
          variant="table"
          onMark={onMark}
          onUndo={onUndo}
        />
        {row.result.t1 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">AMRAP</span>
            <AmrapInput value={row.result.t1Reps} onChange={handleT1AmrapChange} />
          </div>
        )}
      </td>
      {/* T2 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t2Exercise]}
      </td>
      <td
        data-testid={`t2-weight-${row.index}`}
        className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums"
      >
        {row.t2Weight}
      </td>
      <td
        data-testid={`t2-scheme-${row.index}`}
        className="border border-[var(--border-light)] px-2 py-3 text-center align-middle font-semibold text-[13px]"
      >
        {row.t2Sets}&times;{row.t2Reps}
        <br />
        <StageTag stage={row.t2Stage} size="md" />
      </td>
      <td
        data-testid={`t2-result-${row.index}`}
        className="border border-[var(--border-light)] px-2 py-3 text-center align-middle"
      >
        <ResultCell
          index={row.index}
          tier="t2"
          result={row.result.t2}
          variant="table"
          onMark={onMark}
          onUndo={onUndo}
        />
      </td>
      {/* T3 */}
      <td className="border border-[var(--border-light)] px-2 py-3 text-left align-middle font-bold text-[13px]">
        {NAMES[row.t3Exercise]}
      </td>
      <td
        data-testid={`t3-weight-${row.index}`}
        className="font-mono border border-[var(--border-light)] px-2 py-3 text-center align-middle font-extrabold text-[15px] tabular-nums"
        title="T3 weight increases when AMRAP set reaches 25+ reps"
      >
        {row.t3Weight}
        <br />
        <span className="text-[10px] text-[var(--text-muted)] font-normal">3&times;15</span>
      </td>
      <td
        data-testid={`t3-result-${row.index}`}
        className="border border-[var(--border-light)] px-2 py-3 text-center align-middle"
      >
        <ResultCell
          index={row.index}
          tier="t3"
          result={row.result.t3}
          variant="table"
          onMark={onMark}
          onUndo={onUndo}
        />
        {row.result.t3 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">AMRAP</span>
            <AmrapInput value={row.result.t3Reps} onChange={handleT3AmrapChange} />
          </div>
        )}
      </td>
    </tr>
  );
}, areRowsEqual);
