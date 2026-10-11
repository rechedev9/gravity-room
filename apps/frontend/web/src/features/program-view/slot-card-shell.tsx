import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow } from '@gzclp/domain/types';
import { BarbellIcon, CheckIcon, CrossIcon } from '@/components/glyph-icons';
import { cn } from '@/lib/cn';
import { localizedExerciseName } from '@/lib/catalog-display';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { StageTag } from './stage-tag';
import { tierColorClass } from './tier-color';

export interface SlotCardShellProps {
  readonly slot: GenericSlotRow;
  /** The lift to do next: it gets the gold hairline, like the mobile focal card. */
  readonly focal?: boolean;
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly children?: ReactNode;
}

/** Sets x reps as text, e.g. "5x3+" or "3x8-12". Prescription ladders show the working set. */
export function slotScheme(slot: GenericSlotRow): string {
  const working = slot.prescriptions?.[slot.prescriptions.length - 1];
  const sets = working?.sets ?? slot.sets;
  const reps = slot.complexReps ?? working?.reps ?? slot.reps;
  const range = slot.repsMax !== undefined ? `-${slot.repsMax}` : '';
  return `${sets}×${reps}${range}${slot.isAmrap ? '+' : ''}`;
}

/**
 * Card of one lift, shared by every tracker view and the program preview. Mirrors the mobile
 * slot card: icon tile, exercise name, mono line with tier, scheme and load, and a mono status
 * label on the right. The caller renders the set rows or actions as `children`.
 */
export function SlotCardShell({
  slot,
  focal = false,
  testId,
  ariaLabel,
  children,
}: SlotCardShellProps): ReactNode {
  const { t } = useTranslation();
  const { format } = useUnitPreference();
  const hasPrescriptions = slot.prescriptions !== undefined;
  const isGpp = slot.isGpp === true;
  const showStage = slot.stagesCount > 1 && !hasPrescriptions && !isGpp && slot.stage > 0;
  const showWeight = !isGpp && slot.isBodyweight !== true && slot.weight > 0;
  const exerciseLabel = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);
  const status =
    slot.result === 'success'
      ? { label: t('tracker.slot_status.success'), tone: 'text-ok' }
      : slot.result === 'fail'
        ? { label: t('tracker.slot_status.fail'), tone: 'text-fail' }
        : { label: t('tracker.slot_status.awaiting'), tone: 'text-accent' };

  return (
    <section
      data-testid={testId}
      data-slot-id={slot.slotId}
      data-tier={slot.tier.toUpperCase()}
      data-slot-result={slot.result ?? 'open'}
      data-focal={focal ? 'true' : undefined}
      aria-label={ariaLabel ?? exerciseLabel}
      className={cn(
        'flex flex-col gap-3 rounded-card border bg-card p-4',
        focal ? 'border-accent-dim' : 'border-rule',
        slot.isChanged && slot.result === undefined && 'bg-changed'
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-2',
            slot.result === 'success'
              ? 'text-ok'
              : slot.result === 'fail'
                ? 'text-fail'
                : 'text-muted'
          )}
        >
          {slot.result === 'success' ? (
            <CheckIcon size={22} />
          ) : slot.result === 'fail' ? (
            <CrossIcon size={22} />
          ) : (
            <BarbellIcon size={22} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="type-title min-w-0 truncate leading-6 text-title">{exerciseLabel}</h3>
            {showStage && <StageTag stage={slot.stage} size="sm" />}
          </div>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[13px] text-label tabular-nums">
            <span className={cn('font-bold', tierColorClass(slot.role))}>
              {slot.tier.toUpperCase()}
            </span>
            <span>{slotScheme(slot)}</span>
            {showWeight && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-muted">{format(slot.weight)}</span>
              </>
            )}
            {slot.isDeload && (
              <span className="text-2xs font-bold uppercase tracking-wider text-muted">
                {'↓'} {t('tracker.day_view.deload_badge')}
              </span>
            )}
          </p>
        </div>
        <span
          data-testid="slot-status"
          className={cn(
            'w-[5.25rem] shrink-0 text-right font-mono text-[10px] font-bold uppercase leading-[1.4] tracking-[0.14em]',
            status.tone
          )}
        >
          {status.label}
        </span>
      </div>

      {slot.notes !== undefined && <p className="text-xs text-muted">{slot.notes}</p>}

      {children}
    </section>
  );
}
