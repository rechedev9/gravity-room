import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { trackEvent } from '@/lib/analytics';
import { clamp, resolveTileState } from './shared';

// ---------------------------------------------------------------------------
// DayView — jump form + compact summary of selected day
// ---------------------------------------------------------------------------

interface DayViewProps {
  rows: readonly GenericWorkoutRow[];
  selectedDayIndex: number;
  currentDayIndex: number;
  resultTimestamps: Readonly<Record<string, string>> | undefined;
  completedDayIndices: ReadonlySet<number> | undefined;
  context: 'preview' | 'tracker';
  onSelectDay: (index: number) => void;
}

export function DayView({
  rows,
  selectedDayIndex,
  currentDayIndex,
  resultTimestamps,
  completedDayIndices,
  context,
  onSelectDay,
}: DayViewProps): ReactNode {
  const { t } = useTranslation();
  const jumpInputId = useId();
  const jumpLabelId = useId();
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState(false);

  function handleJump(e?: FormEvent): void {
    e?.preventDefault();
    const parsed = parseInt(jumpValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > rows.length) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    setJumpValue('');
    trackEvent('program_navigation_jump', { context });
    onSelectDay(parsed - 1);
  }

  function handleJumpKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleJump();
  }

  const selectedRow = rows[clamp(selectedDayIndex, 0, rows.length - 1)];
  const state = selectedRow
    ? resolveTileState(
        selectedRow.index,
        selectedDayIndex,
        currentDayIndex,
        resultTimestamps,
        completedDayIndices
      )
    : 'pending';

  return (
    <div className="flex flex-col gap-4">
      {/* Jump form */}
      <form
        onSubmit={handleJump}
        className="flex items-center gap-2"
        aria-label={t('calendar_navigator.jump_form_aria')}
      >
        <label
          id={jumpLabelId}
          htmlFor={jumpInputId}
          className="text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
        >
          {t('calendar_navigator.jump_label')}
        </label>
        <input
          id={jumpInputId}
          type="number"
          min={1}
          max={rows.length}
          value={jumpValue}
          onChange={(e) => {
            setJumpValue(e.target.value);
            setJumpError(false);
          }}
          onKeyDown={handleJumpKeyDown}
          aria-labelledby={jumpLabelId}
          aria-invalid={jumpError}
          aria-describedby={jumpError ? `${jumpInputId}-error` : undefined}
          placeholder={`1–${rows.length}`}
          className={`
            w-20 px-2 py-1.5 text-xs font-mono tabular-nums
            border bg-card text-main
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
            ${jumpError ? 'border-red-500' : 'border-rule'}
          `}
        />
        <button
          type="submit"
          aria-label={t('calendar_navigator.jump_button_aria')}
          className="
            text-xs font-bold px-3 py-1.5 min-h-[44px]
            border-2 border-rule bg-card text-muted
            hover:bg-hover-row hover:text-main hover:border-rule-light
            active:scale-95 cursor-pointer transition-all duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
          "
        >
          {t('calendar_navigator.jump_button')}
        </button>
        {jumpError && (
          <span id={`${jumpInputId}-error`} role="alert" className="text-xs text-red-500">
            {t('calendar_navigator.jump_error', { max: rows.length })}
          </span>
        )}
      </form>

      {/* Compact summary of selected day */}
      {selectedRow && (
        <section
          aria-label={t('calendar_navigator.day_summary_aria', {
            index: selectedRow.index + 1,
          })}
          className="flex items-center gap-3 px-3 py-2 border border-rule bg-card"
        >
          <span className="text-sm font-bold font-mono tabular-nums text-accent">
            #{selectedRow.index + 1}
          </span>
          <span className="text-xs text-muted">{selectedRow.dayName}</span>
          <span
            className={`ml-auto text-xs font-semibold ${
              state === 'completed'
                ? 'text-accent'
                : state === 'current'
                  ? 'text-accent'
                  : 'text-muted'
            }`}
          >
            {t(`calendar_navigator.tile_state.${state}`)}
          </span>
        </section>
      )}
    </div>
  );
}
