import type { ReactNode } from 'react';
import type { GenericSlotRow } from '@gzclp/domain/types';
import { StageTag } from './stage-tag';
import { tierColorClass } from './tier-color';
import { CornerTicks } from '@/components/corner-ticks';

export interface SlotCardShellProps {
  readonly slot: GenericSlotRow;
  readonly isCurrent: boolean;
  readonly children: ReactNode;
}

/**
 * Shared outer wrapper + header row for slot cards used in both DayView and
 * DetailedDayView.  The caller is responsible for rendering the middle section
 * (prescription/compact scheme vs per-set table) as `children`.
 */
export function SlotCardShell({ slot, isCurrent, children }: SlotCardShellProps): ReactNode {
  const isDone = slot.result !== undefined;
  const needsAmrap = slot.result === 'success' && slot.isAmrap && slot.amrapReps === undefined;
  const fullyDone = isDone && !needsAmrap;
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;
  const showStage = slot.stagesCount > 1 && !hasPrescriptions && !isGpp;
  const isCurrentSlot = isCurrent && !fullyDone;

  return (
    <div
      className={`relative border border-rule bg-card px-4 py-3.5 transition-opacity duration-200 ${
        fullyDone ? 'opacity-70' : ''
      } ${isCurrentSlot ? 'accent-left-gold' : 'accent-left-muted'} ${
        slot.isChanged && !isDone ? 'bg-changed' : ''
      }`}
      style={{ animation: 'card-enter var(--duration-fast) var(--ease-standard)' }}
    >
      {isCurrentSlot && <CornerTicks />}
      {/* Row 1: Tier + Exercise + Stage */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-xs font-bold uppercase tracking-widest font-mono ${tierColorClass(slot.role)}`}
        >
          {slot.tier.toUpperCase()}
        </span>
        <span className="font-bold text-sm text-main truncate">{slot.exerciseName}</span>
        {showStage && slot.stage > 0 && <StageTag stage={slot.stage} size="sm" />}
        {slot.isDeload && (
          <span className="text-2xs font-bold text-muted tracking-wider uppercase font-mono">
            {'↓'} Deload
          </span>
        )}
      </div>

      {/* Notes */}
      {slot.notes !== undefined && <p className="text-xs text-muted mb-1.5">{slot.notes}</p>}

      {children}
    </div>
  );
}
