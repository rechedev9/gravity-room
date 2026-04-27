import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ResultValue, SetLogEntry } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_REPS = 0;
const MAX_REPS = 999;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetIndicatorsProps {
  readonly sets: number;
  readonly result: ResultValue | undefined;
  readonly isAmrap: boolean;
  /** Target reps per set (from stage definition). */
  readonly targetReps?: number;
  /** In-progress set logs from useSetLogging hook. */
  readonly setLogs?: readonly SetLogEntry[];
  /** Committed set logs from server (slot already has a result). */
  readonly committedSetLogs?: readonly SetLogEntry[];
  /** Called when user taps a set circle (sequential only). */
  readonly onSetTap?: (setIndex: number, reps: number) => void;
}

// ---------------------------------------------------------------------------
// Inline Stepper Sub-Component
// ---------------------------------------------------------------------------

interface InlineStepperProps {
  readonly initialReps: number;
  readonly isAmrap: boolean;
  readonly setIndex: number;
  readonly totalSets: number;
  readonly onConfirm: (reps: number) => void;
  readonly onCancel: () => void;
}

function InlineStepper({
  initialReps,
  isAmrap,
  setIndex,
  totalSets,
  onConfirm,
  onCancel,
}: InlineStepperProps): ReactNode {
  const [reps, setReps] = useState(initialReps);

  const decrement = (): void => {
    setReps((r) => Math.max(MIN_REPS, r - 1));
  };

  const increment = (): void => {
    setReps((r) => Math.min(MAX_REPS, r + 1));
  };

  const handleConfirm = (): void => {
    onConfirm(reps);
  };

  const amrapLabel = isAmrap ? ' (AMRAP)' : '';
  const ariaLabel = `Reps serie ${setIndex + 1} de ${totalSets}${amrapLabel}`;

  return (
    <div
      className="inline-flex items-center gap-1.5 animate-[card-enter_var(--duration-instant)_var(--ease-standard)]"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={reps <= MIN_REPS}
        aria-label="Disminuir reps"
        className="min-w-[36px] min-h-[36px] font-bold border-2 border-rule bg-card text-btn-text cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-title active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-30 disabled:cursor-default text-sm"
      >
        &minus;
      </button>
      <span
        className="w-10 flex items-center justify-center py-1 text-center text-[13px] font-bold bg-transparent border-y-2 border-x-0 border-rule text-title tabular-nums select-none"
        aria-live="polite"
      >
        {reps}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={reps >= MAX_REPS}
        aria-label="Aumentar reps"
        className="min-w-[36px] min-h-[36px] font-bold border-2 border-rule bg-card text-btn-text cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-title active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-30 disabled:cursor-default text-sm"
      >
        +
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        aria-label="Confirmar reps"
        className="min-w-[36px] min-h-[36px] font-bold border-2 border-ok-ring bg-transparent text-ok cursor-pointer transition-all duration-150 hover:bg-ok-bg active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none text-sm"
      >
        &#10003;
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="min-w-[36px] min-h-[36px] font-bold border-2 border-fail-ring bg-transparent text-fail cursor-pointer transition-all duration-150 hover:bg-fail-bg active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none text-sm"
      >
        &#10007;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Renders a row of circle indicators representing the set count for a slot.
 *
 * When `onSetTap` is provided, circles become interactive tap targets:
 * - Completed sets show filled circles (green for met target, red for below).
 * - The next unlogged set is tappable and opens an inline stepper.
 * - Future sets are inert.
 *
 * When `onSetTap` is not provided, falls back to legacy decorative behavior
 * (all circles share the same color based on slot-level result).
 */
export function SetIndicators({
  sets,
  result,
  isAmrap,
  targetReps,
  setLogs,
  committedSetLogs,
  onSetTap,
}: SetIndicatorsProps): ReactNode {
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);

  const handleSetTap = useCallback((setIndex: number): void => {
    setActiveSetIndex(setIndex);
  }, []);

  const handleStepperConfirm = useCallback(
    (reps: number): void => {
      if (activeSetIndex !== null && onSetTap) {
        onSetTap(activeSetIndex, reps);
      }
      setActiveSetIndex(null);
    },
    [activeSetIndex, onSetTap]
  );

  const handleStepperCancel = useCallback((): void => {
    setActiveSetIndex(null);
  }, []);

  if (sets <= 0) return null;

  // Determine which set logs to display — in-progress local logs take priority
  const displayLogs = setLogs ?? committedSetLogs;
  const isInteractive = onSetTap !== undefined && result === undefined;

  // Legacy decorative mode: no onSetTap or result already set without setLogs
  if (!isInteractive && displayLogs === undefined) {
    return renderDecorativeCircles(sets, result, isAmrap);
  }

  // Interactive or committed-with-logs mode
  const logCount = displayLogs?.length ?? 0;
  const nextUnloggedIndex = logCount;
  const effectiveTargetReps = targetReps ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap" aria-label={`${sets} series`}>
        {Array.from({ length: sets }, (_, i) => {
          const isLast = i === sets - 1;
          const showAmrapMark = isAmrap && isLast;
          const log = displayLogs?.[i];
          const isCompleted = log !== undefined;
          const isFailed = isCompleted && log.reps < effectiveTargetReps;
          const isTappable = isInteractive && i === nextUnloggedIndex && activeSetIndex === null;

          if (isCompleted) {
            const colorClass = isFailed ? 'border-fail bg-fail' : 'border-ok bg-ok';
            return (
              <span
                key={i}
                role="img"
                aria-label={`Serie ${i + 1}: ${log.reps} repeticiones`}
                className={`relative w-5 h-5 rounded-full border-2 ${colorClass} flex items-center justify-center`}
              >
                {showAmrapMark && (
                  <span className="absolute -top-1.5 -right-1.5 text-2xs font-bold text-accent">
                    +
                  </span>
                )}
              </span>
            );
          }

          if (isTappable) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSetTap(i)}
                aria-label={`Registrar serie ${i + 1} de ${sets}`}
                className="relative w-7 h-7 rounded-full border-2 border-accent bg-transparent cursor-pointer transition-all duration-150 hover:bg-accent/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none flex items-center justify-center"
              >
                {showAmrapMark && (
                  <span className="absolute -top-1.5 -right-1.5 text-2xs font-bold text-accent">
                    +
                  </span>
                )}
              </button>
            );
          }

          // Inert (future set, not yet reachable)
          return (
            <span
              key={i}
              className="relative w-5 h-5 rounded-full border-2 border-rule bg-transparent opacity-40"
            >
              {showAmrapMark && (
                <span className="absolute -top-1.5 -right-1.5 text-2xs font-bold text-accent">
                  +
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Inline stepper for active set */}
      {activeSetIndex !== null && isInteractive && (
        <InlineStepper
          initialReps={effectiveTargetReps}
          isAmrap={isAmrap && activeSetIndex === sets - 1}
          setIndex={activeSetIndex}
          totalSets={sets}
          onConfirm={handleStepperConfirm}
          onCancel={handleStepperCancel}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy decorative rendering
// ---------------------------------------------------------------------------

function renderDecorativeCircles(
  sets: number,
  result: ResultValue | undefined,
  isAmrap: boolean
): ReactNode {
  const colorClass =
    result === undefined
      ? 'border-rule bg-transparent'
      : result === 'success'
        ? 'border-ok bg-ok'
        : 'border-fail bg-fail';

  return (
    <div className="flex items-center gap-1.5 flex-wrap" aria-label={`${sets} series`}>
      {Array.from({ length: sets }, (_, i) => {
        const isLast = i === sets - 1;
        const showAmrapMark = isAmrap && isLast;

        return (
          <span key={i} className={`relative w-5 h-5 rounded-full border-2 ${colorClass}`}>
            {showAmrapMark && (
              <span className="absolute -top-1.5 -right-1.5 text-2xs font-bold text-accent">+</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
