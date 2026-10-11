import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerIcon } from '@/components/glyph-icons';

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
 * Rest countdown after confirming a set, as a banner docked above the phone tab bar (and at
 * the foot of the content column on desktop), like the mobile app. Pure presentation + tick;
 * the parent owns when to mount/unmount and which duration to use.
 */
export function RestTimer({ seconds, onSkip, onComplete }: RestTimerProps): React.ReactNode {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(seconds);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const skipRef = useRef<HTMLButtonElement>(null);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setRemaining(seconds);
    completedRef.current = false;
  }, [seconds]);

  // Gym one-handed use: land focus on Skip so a double-tap / Enter dismisses rest
  // without hunting the banner. Soft focus (no scroll jump).
  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
  }, []);

  // Floating chrome (toasts) reads this flag to sit above the banner while it is up.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset['restBanner'] = 'true';
    return (): void => {
      delete root.dataset['restBanner'];
    };
  }, []);

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

  // Stable status name (no per-tick countdown in the accessible name: that
  // would re-announce every second for up to 3 minutes on primary lifts).
  const statusLabel = t('tracker.rest_timer.aria', { time: formatMmSs(seconds) });
  const elapsed = seconds > 0 ? (seconds - remaining) / seconds : 0;

  return (
    <div
      role="status"
      aria-live="off"
      aria-label={statusLabel}
      data-testid="rest-timer"
      className="rest-banner fixed inset-x-0 bottom-[var(--bottom-chrome)] z-[54] border-t border-rule bg-header lg:left-[var(--sidebar-width)]"
    >
      <div aria-hidden="true" className="absolute inset-x-0 -top-px h-px overflow-hidden">
        <div
          className="h-px origin-left bg-accent transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${elapsed})` }}
        />
      </div>
      <div className="mx-auto flex h-14 max-w-[1300px] items-center gap-3 px-5 sm:px-6">
        <TimerIcon size={24} className="shrink-0 text-accent" />
        <span className="text-base text-muted">{t('tracker.rest_timer.label')}</span>
        <span
          className="font-sans text-[22px] font-bold leading-none tabular-nums text-accent"
          aria-hidden="true"
        >
          {formatMmSs(remaining)}
        </span>
        <button
          ref={skipRef}
          type="button"
          onClick={onSkip}
          data-testid="rest-timer-skip"
          className="type-button ml-auto min-h-11 shrink-0 rounded-control px-3 text-muted cursor-pointer transition-colors duration-[var(--duration-press)] hover:bg-card hover:text-main"
        >
          {t('tracker.rest_timer.skip')}
        </button>
      </div>
    </div>
  );
}
