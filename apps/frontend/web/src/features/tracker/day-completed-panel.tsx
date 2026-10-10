import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { isCycleDayName, localizedExerciseName } from '@/lib/catalog-display';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { tierColorClass } from '@/features/program-view/tier-color';
import { slotScheme } from '@/features/program-view/slot-card-shell';
import { CheckIcon, CrossIcon } from '@/components/glyph-icons';
import { findNextScheduled, workoutVolume } from './session-history';
import { useUnitPreference } from '@/hooks/use-unit-preference';

export interface DayCompletedPanelProps {
  readonly rows: readonly GenericWorkoutRow[];
  readonly workout: GenericWorkoutRow;
  readonly totalDays: number;
  /** Next workout in the program, if any. */
  readonly nextWorkout: GenericWorkoutRow | null;
  readonly onGoToNextDay: () => void;
  /** Omitted when the day's results are already listed right below the panel. */
  readonly onReview?: () => void;
}

/**
 * A finished day is a screen, not the absence of pending cards: what was
 * lifted, which of it was a record, and what the engine has queued for the
 * next time each lift comes up.
 */
export function DayCompletedPanel({
  rows,
  workout,
  totalDays,
  nextWorkout,
  onGoToNextDay,
  onReview,
}: DayCompletedPanelProps): ReactNode {
  const { t } = useTranslation();
  const { unit, toDisplay, format } = useUnitPreference();
  const panelRef = useRef<HTMLElement>(null);

  // The last set is usually confirmed far below the top of the page: bring the
  // result into view instead of leaving the user staring at a finished card.
  useEffect(() => {
    const el = panelRef.current;
    if (el === null) return;
    el.scrollIntoView?.({ block: 'start' });
  }, []);

  const lines = workout.slots.map((slot) => {
    const next = findNextScheduled(rows, workout.index, slot.slotId);
    return {
      slot,
      next,
      isRecord:
        slot.result !== undefined &&
        detectGenericPersonalRecord(rows, workout.index, slot.slotId, slot.result),
      reps:
        slot.setLogs !== undefined && slot.setLogs.length > 0
          ? slot.setLogs.map((s) => s.reps).join(' ')
          : slotScheme(slot),
    };
  });
  const recordCount = lines.filter((l) => l.isRecord).length;

  return (
    <section
      ref={panelRef}
      data-testid="day-completed-panel"
      aria-label={t('tracker.day_completed.aria', { day: workout.index + 1 })}
      className="mb-3 flex scroll-mt-4 flex-col gap-5 rounded-card border border-rule bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="type-kicker mb-2 text-ok">{t('tracker.day_completed.closed')}</p>
          <h2 className="type-display m-0 text-title">
            {t('tracker.day_completed.title', { day: workout.index + 1 })}
          </h2>
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="type-kicker mb-1 text-label">{t('tracker.day_completed.volume')}</dt>
            <dd className="font-display m-0 text-[34px] leading-none tracking-[0.02em] text-title tabular-nums">
              {toDisplay(workoutVolume(workout)).toLocaleString()} {unit}
            </dd>
          </div>
          <div>
            <dt className="type-kicker mb-1 text-label">{t('tracker.day_completed.records')}</dt>
            <dd className="font-display m-0 text-[34px] leading-none tracking-[0.02em] text-accent tabular-nums">
              {recordCount}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="flex flex-col border-y border-rule">
        {lines.map(({ slot, next, isRecord, reps }) => (
          <li
            key={slot.slotId}
            data-testid="day-completed-line"
            data-slot-result={slot.result}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule py-3 last:border-b-0"
          >
            <span aria-hidden="true" className={slot.result === 'fail' ? 'text-fail' : 'text-ok'}>
              {slot.result === 'fail' ? <CrossIcon size={18} /> : <CheckIcon size={18} />}
            </span>
            <span className={`font-mono text-[11px] font-bold ${tierColorClass(slot.role)}`}>
              {slot.tier.toUpperCase()}
            </span>
            <span className="text-base font-semibold text-title">
              {localizedExerciseName(t, slot.exerciseId, slot.exerciseName)}
            </span>
            <span className="whitespace-nowrap font-mono text-[13px] text-label tabular-nums">
              {slot.weight > 0 ? `${format(slot.weight)} \u00b7 ` : ''}
              {reps}
            </span>
            {isRecord && (
              <span className="rounded-chip bg-accent px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-on-accent">
                {t('tracker.day_completed.record')}
              </span>
            )}
            {next !== null && next.weight > 0 && (
              <span className="ml-auto flex items-baseline gap-2">
                <span className="text-sm text-label">{t('tracker.day_completed.next')}</span>
                <span className="font-mono text-sm font-bold text-ok tabular-nums">
                  {format(next.weight)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>

      {nextWorkout !== null && nextWorkout.slots.length > 0 && (
        <div data-testid="next-session">
          <h3 className="type-kicker mb-1 text-label">
            {isCycleDayName(nextWorkout.dayName)
              ? t('tracker.day_completed.next_session_plain', { day: nextWorkout.index + 1 })
              : t('tracker.day_completed.next_session', {
                  day: nextWorkout.index + 1,
                  name: nextWorkout.dayName,
                })}
          </h3>
          <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 xl:grid-cols-3">
            {nextWorkout.slots.map((slot) => (
              <li
                key={slot.slotId}
                className="flex items-baseline justify-between gap-4 py-1.5 text-[15px]"
              >
                <span className="min-w-0 truncate text-muted">
                  {localizedExerciseName(t, slot.exerciseId, slot.exerciseName)}
                </span>
                <span className="shrink-0 text-main tabular-nums">
                  {slot.weight > 0 ? `${format(slot.weight)} \u00b7 ` : ''}
                  {slotScheme(slot)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {nextWorkout !== null && (
          <button
            type="button"
            data-testid="day-completed-next"
            onClick={onGoToNextDay}
            style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
            className="type-button min-h-12 w-full rounded-control bg-accent px-7 text-on-accent cursor-pointer transition-[transform,background-color] duration-[var(--duration-press)] ease-[var(--ease-press)] hover:bg-accent-hover active:translate-y-px sm:w-auto"
          >
            {isCycleDayName(nextWorkout.dayName)
              ? t('tracker.day_completed.next_day_plain', { day: nextWorkout.index + 1 })
              : t('tracker.day_completed.next_day', {
                  day: nextWorkout.index + 1,
                  name: nextWorkout.dayName,
                })}
          </button>
        )}
        {onReview !== undefined && (
          <button
            type="button"
            data-testid="day-completed-review"
            onClick={onReview}
            className="type-button min-h-12 rounded-control px-4 text-muted cursor-pointer transition-colors duration-[var(--duration-press)] hover:bg-surface-2 hover:text-main"
          >
            {t('tracker.day_completed.review')}
          </button>
        )}
        <span className="ml-auto text-sm text-label">
          {t('tracker.day_completed.progress', { day: workout.index + 1, total: totalDays })}
        </span>
      </div>
    </section>
  );
}
