import { memo, useCallback } from 'react';
import { NAMES } from '@gzclp/shared/program';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@gzclp/shared/types';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeInput } from './rpe-input';

/**
 * Total number of columns in the workout table.
 * Must match the column structure in week-section.tsx:
 * # + Day + T1(Exercise, kg, Scheme, Result) + T2(Exercise, kg, Scheme, Result) + T3(Exercise, kg, Result) = 13
 */
const TABLE_COLUMN_COUNT = 13;

interface WorkoutRowProps {
  row: WorkoutRowType;
  isCurrent: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onSetAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  onSetRpe?: (index: number, tier: 't1' | 't3', rpe: number | undefined) => void;
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
    p.result.t3Reps === n.result.t3Reps &&
    p.result.rpe === n.result.rpe &&
    p.result.t3Rpe === n.result.t3Rpe
  );
}

export const WorkoutRow = memo(function WorkoutRow({
  row,
  isCurrent,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: WorkoutRowProps) {
  const allDone = row.result.t1 && row.result.t2 && row.result.t3;
  // fix: AMRAP sub-row only shows for success results
  const t1Success = row.result.t1 === 'success';
  const t3Success = row.result.t3 === 'success';
  // fix: collapse detail rows when session complete and no AMRAP/RPE data entered
  const hasEnteredData =
    row.result.t1Reps !== undefined ||
    row.result.t3Reps !== undefined ||
    row.result.rpe !== undefined ||
    row.result.t3Rpe !== undefined;
  const hideDetailRow = allDone && !hasEnteredData;

  const handleT1AmrapChange = useCallback(
    (reps: number | undefined) => onSetAmrapReps(row.index, 't1Reps', reps),
    [onSetAmrapReps, row.index]
  );

  const handleT3AmrapChange = useCallback(
    (reps: number | undefined) => onSetAmrapReps(row.index, 't3Reps', reps),
    [onSetAmrapReps, row.index]
  );

  const handleRpeChange = useCallback(
    (rpe: number | undefined) => onSetRpe?.(row.index, 't1', rpe),
    [onSetRpe, row.index]
  );

  const handleT3RpeChange = useCallback(
    (rpe: number | undefined) => onSetRpe?.(row.index, 't3', rpe),
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

  return (
    <>
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
              title="Agregar a Google Calendar"
              aria-label="Agregar a Google Calendar"
              className="font-mono inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-xs text-[var(--text-muted)] hover:text-[var(--fill-progress)] transition-colors mt-0.5"
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
          title="El peso T3 sube cuando el set AMRAP llega a 25+ repeticiones"
        >
          {row.t3Weight}
          <br />
          <span className="text-xs text-[var(--text-muted)] font-normal">3&times;15</span>
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
        </td>
      </tr>
      {/* fix: AMRAP sub-row only for success, collapse when session done with no data */}
      {t1Success && !hideDetailRow && (
        <tr
          className={[
            'transition-colors',
            allDone ? 'opacity-40 hover:opacity-70' : '',
            isCurrent ? 'border-l-4 border-l-[var(--fill-progress)]' : '',
            row.isChanged && !allDone ? '[&>td]:!bg-[var(--bg-changed)]' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <td
            colSpan={TABLE_COLUMN_COUNT}
            className="border-x border-b border-[var(--border-light)] px-4 py-1"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  T1 AMRAP
                </span>
                <AmrapInput value={row.result.t1Reps} onChange={handleT1AmrapChange} />
              </div>
              {onSetRpe && (
                <div className="flex items-center gap-2" data-rpe-input={row.index}>
                  <RpeInput value={row.result.rpe} onChange={handleRpeChange} tier="t1" />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
      {t3Success && !hideDetailRow && (
        <tr
          className={[
            'transition-colors',
            allDone ? 'opacity-40 hover:opacity-70' : '',
            isCurrent ? 'border-l-4 border-l-[var(--fill-progress)]' : '',
            row.isChanged && !allDone ? '[&>td]:!bg-[var(--bg-changed)]' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <td
            colSpan={TABLE_COLUMN_COUNT}
            className="border-x border-b border-[var(--border-light)] px-4 py-1"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  T3 AMRAP
                </span>
                <AmrapInput value={row.result.t3Reps} onChange={handleT3AmrapChange} />
              </div>
              {onSetRpe && (
                <div className="flex items-center gap-2">
                  <RpeInput value={row.result.t3Rpe} onChange={handleT3RpeChange} tier="t3" />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}, areRowsEqual);
