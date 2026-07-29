import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RestTimerProps {
  /** Total rest duration when the timer starts. */
  readonly seconds: number;
  readonly onSkip: () => void;
  readonly onComplete?: () => void;
}

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Sticky rest countdown after confirming a set. Pure presentation + tick;
 * the parent owns when to mount/unmount and which duration to use.
 */
export function RestTimer({ seconds, onSkip, onComplete }: RestTimerProps): React.ReactNode {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(seconds);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setRemaining(seconds);
    completedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    const id = window.setTimeout(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return (): void => {
      window.clearTimeout(id);
    };
  }, [remaining]);

  // Stable status name (no per-tick countdown in the accessible name — that
  // would re-announce every second for up to 3 minutes on primary lifts).
  const statusLabel = t('tracker.rest_timer.aria', { time: formatMmSs(seconds) });

  return (
    <div
      role="status"
      aria-live="off"
      aria-label={statusLabel}
      className="fixed left-1/2 z-[60] -translate-x-1/2 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] lg:bottom-6 flex items-center gap-3 bg-ink border border-accent px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)] max-w-[calc(100vw-2rem)]"
      data-testid="rest-timer"
    >
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-accent">
          {t('tracker.rest_timer.label')}
        </span>
        <span className="font-mono text-2xl tabular-nums text-main leading-none" aria-hidden="true">
          {formatMmSs(remaining)}
        </span>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="shrink-0 min-h-[44px] px-3 font-mono text-2xs font-bold tracking-[0.12em] uppercase text-muted border border-rule hover:text-main hover:border-rule-light transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        {t('tracker.rest_timer.skip')}
      </button>
    </div>
  );
}
