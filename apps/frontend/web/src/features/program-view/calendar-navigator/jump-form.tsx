import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// JumpForm — extracted so it can be reused in week/month modes
// ---------------------------------------------------------------------------

interface JumpFormProps {
  rows: readonly GenericWorkoutRow[];
  context: 'preview' | 'tracker';
  onSelectDay: (index: number) => void;
}

export function JumpForm({ rows, context, onSelectDay }: JumpFormProps): ReactNode {
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

  return (
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
  );
}
