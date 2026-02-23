import { memo, useCallback } from 'react';
import { NAMES } from '@gzclp/shared/program';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@gzclp/shared/types';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { StageTag } from './stage-tag';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RpeInput } from './rpe-input';

interface WorkoutRowCardProps {
  row: WorkoutRowType;
  isCurrent: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onSetAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  onSetRpe?: (index: number, tier: 't1' | 't3', rpe: number | undefined) => void;
  onUndo: (index: number, tier: Tier) => void;
}

function TierSection({
  label,
  exercise,
  weight,
  scheme,
  stage,
  showStage,
  index,
  tier,
  result,
  amrapReps,
  onSetAmrapReps,
  onMark,
  onUndo,
}: {
  label: string;
  exercise: string;
  weight: number;
  scheme: string;
  stage?: number;
  showStage: boolean;
  index: number;
  tier: Tier;
  result?: ResultValue;
  amrapReps?: number;
  onSetAmrapReps?: (reps: number | undefined) => void;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onUndo: (index: number, tier: Tier) => void;
}): React.ReactNode {
  const isT1 = tier === 't1';
  return (
    <div className="py-2 border-b border-[var(--border-light)] last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-bold uppercase ${isT1 ? 'text-[var(--fill-progress)]' : 'text-[var(--text-muted)]'}`}
          >
            {label}
          </div>
          <div className={`font-bold truncate ${isT1 ? 'text-base' : 'text-[13px]'}`}>
            {exercise}
          </div>
        </div>
        <div
          className="text-center shrink-0"
          title={
            tier === 't3'
              ? 'El peso T3 sube cuando el set AMRAP llega a 25+ repeticiones'
              : undefined
          }
        >
          <div
            className={
              isT1
                ? 'font-display-data text-3xl text-[var(--fill-progress)] tabular-nums'
                : tier === 't3'
                  ? 'text-[15px] font-extrabold tabular-nums text-[var(--text-muted)]'
                  : 'text-[15px] font-extrabold tabular-nums'
            }
          >
            {weight} kg
          </div>
          <div className="text-[12px] font-semibold text-[var(--text-muted)]">
            {scheme}
            {showStage && stage !== undefined && (
              <>
                {' '}
                <StageTag stage={stage} size="md" />
              </>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <ResultCell
            index={index}
            tier={tier}
            result={result}
            variant="card"
            onMark={onMark}
            onUndo={onUndo}
          />
        </div>
      </div>
      {/* fix: AMRAP only shows for success results */}
      {result === 'success' && onSetAmrapReps && (
        <div className="mt-1.5 flex items-center gap-2 pl-1">
          <span className="text-xs text-[var(--text-muted)]">Rep. AMRAP:</span>
          <AmrapInput value={amrapReps} onChange={onSetAmrapReps} variant="card" />
        </div>
      )}
    </div>
  );
}

function areRowCardsEqual(prev: WorkoutRowCardProps, next: WorkoutRowCardProps): boolean {
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

export const WorkoutRowCard = memo(function WorkoutRowCard({
  row,
  isCurrent,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: WorkoutRowCardProps) {
  const allDone = row.result.t1 && row.result.t2 && row.result.t3;

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
        {!allDone && (
          <a
            href={buildGoogleCalendarUrl(row).calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Agregar a Google Calendar"
            aria-label="Agregar a Google Calendar"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-xs text-[var(--text-muted)] hover:text-[var(--fill-progress)] transition-colors"
          >
            ↗ Cal
          </a>
        )}
        <span className="text-xs font-semibold text-[var(--text-muted)]">{row.dayName}</span>
      </div>

      <div data-testid={`t1-result-${row.index}`}>
        <TierSection
          label="T1 — Levantamiento Principal"
          exercise={NAMES[row.t1Exercise]}
          weight={row.t1Weight}
          scheme={`${row.t1Sets}\u00d7${row.t1Reps}`}
          stage={row.t1Stage}
          showStage={true}
          index={row.index}
          tier="t1"
          result={row.result.t1}
          amrapReps={row.result.t1Reps}
          onSetAmrapReps={handleT1AmrapChange}
          onMark={onMark}
          onUndo={onUndo}
        />
        {/* fix: RPE only shows for T1 success */}
        {row.result.t1 === 'success' && onSetRpe && (
          <div className="mt-1 pl-1" data-rpe-input={row.index}>
            <RpeInput value={row.result.rpe} onChange={handleRpeChange} tier="t1" />
          </div>
        )}
      </div>
      <div data-testid={`t2-result-${row.index}`}>
        <TierSection
          label="T2 — Secundario"
          exercise={NAMES[row.t2Exercise]}
          weight={row.t2Weight}
          scheme={`${row.t2Sets}\u00d7${row.t2Reps}`}
          stage={row.t2Stage}
          showStage={true}
          index={row.index}
          tier="t2"
          result={row.result.t2}
          onMark={onMark}
          onUndo={onUndo}
        />
      </div>
      <div data-testid={`t3-result-${row.index}`}>
        <TierSection
          label="T3 — Accesorio"
          exercise={NAMES[row.t3Exercise]}
          weight={row.t3Weight}
          scheme="3&times;15"
          showStage={false}
          index={row.index}
          tier="t3"
          result={row.result.t3}
          amrapReps={row.result.t3Reps}
          onSetAmrapReps={handleT3AmrapChange}
          onMark={onMark}
          onUndo={onUndo}
        />
        {/* fix: independent T3 RPE */}
        {row.result.t3 === 'success' && onSetRpe && (
          <div className="mt-1 pl-1">
            <RpeInput value={row.result.t3Rpe} onChange={handleT3RpeChange} tier="t3" />
          </div>
        )}
      </div>
    </div>
  );
}, areRowCardsEqual);
