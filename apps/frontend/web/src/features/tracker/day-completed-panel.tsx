import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { localizedExerciseName } from '@/lib/catalog-display';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { tierColorClass } from '@/features/program-view/tier-color';
import { findNextScheduled, workoutVolume } from './session-history';

export interface DayCompletedPanelProps {
  readonly rows: readonly GenericWorkoutRow[];
  readonly workout: GenericWorkoutRow;
  readonly totalDays: number;
  /** Next workout in the program, if any. */
  readonly nextWorkout: GenericWorkoutRow | null;
  readonly onGoToNextDay: () => void;
  readonly onReview: () => void;
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
          : `${slot.sets}×${slot.complexReps ?? slot.reps}`,
    };
  });
  const recordCount = lines.filter((l) => l.isRecord).length;

  return (
    <section
      data-testid="day-completed-panel"
      aria-label={t('tracker.day_completed.aria', { day: workout.index + 1 })}
      className="mb-4"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ok">
            {t('tracker.day_completed.closed')}
          </p>
          <h2 className="font-display m-0 text-[44px] leading-[0.9] tracking-[0.03em] text-title sm:text-[60px]">
            {t('tracker.day_completed.title', { day: workout.index + 1 })}
          </h2>
        </div>
        <dl className="flex gap-8 pb-1.5">
          <div>
            <dt className="mb-1 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
              {t('tracker.day_completed.volume')}
            </dt>
            <dd className="font-display m-0 text-[38px] leading-none tracking-[0.02em] text-title tabular-nums">
              {workoutVolume(workout).toLocaleString()} kg
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
              {t('tracker.day_completed.records')}
            </dt>
            <dd className="font-display m-0 text-[38px] leading-none tracking-[0.02em] text-accent tabular-nums">
              {recordCount}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="mb-6 flex flex-col gap-0.5">
        {lines.map(({ slot, next, isRecord, reps }) => (
          <li
            key={slot.slotId}
            data-testid="day-completed-line"
            className={`flex flex-wrap items-center gap-3.5 border-l-[3px] bg-card px-4 py-3.5 ${
              slot.result === 'fail' ? 'border-l-fail' : 'border-l-ok'
            }`}
          >
            <span className={`w-6 font-mono text-[11px] font-bold ${tierColorClass(slot.role)}`}>
              {slot.tier.toUpperCase()}
            </span>
            <span className="text-[14.5px] font-bold text-title">
              {localizedExerciseName(t, slot.exerciseId, slot.exerciseName)}
            </span>
            <span className="whitespace-nowrap font-mono text-[13px] text-muted tabular-nums">
              {slot.weight > 0 ? `${slot.weight} kg · ` : ''}
              {reps}
            </span>
            {isRecord && (
              <span className="bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-on-accent">
                {t('tracker.day_completed.record')}
              </span>
            )}
            {next !== null && next.weight > 0 && (
              <span className="ml-auto flex items-center gap-2.5">
                <span className="font-mono text-xs text-info">
                  {t('tracker.day_completed.next')}
                </span>
                <span className="font-mono text-sm font-bold text-ok tabular-nums">
                  {next.weight} kg
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {nextWorkout !== null && (
          <button
            type="button"
            data-testid="day-completed-next"
            onClick={onGoToNextDay}
            style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
            className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {t('tracker.day_completed.next_day', {
              day: nextWorkout.index + 1,
              name: nextWorkout.dayName,
            })}
          </button>
        )}
        <button
          type="button"
          data-testid="day-completed-review"
          onClick={onReview}
          className="border-[1.5px] border-rule-light px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-main cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {t('tracker.day_completed.review')}
        </button>
        <span className="font-mono text-2xs text-info">
          {t('tracker.day_completed.progress', { day: workout.index + 1, total: totalDays })}
        </span>
      </div>
    </section>
  );
}
