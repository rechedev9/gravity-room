import { useState, useEffect, useRef } from 'react';

const DURATION_KEY = 'rest-timer-duration';
const DURATION_MIN = 10;
const DURATION_MAX = 600;
const DURATION_DEFAULT = 90;

export interface UseRestTimerReturn {
  readonly remaining: number;
  readonly isRunning: boolean;
  readonly duration: number;
  readonly start: () => void;
  readonly startIfIdle: () => void;
  readonly stop: () => void;
  readonly setDuration: (seconds: number) => void;
}

function readDuration(): number {
  const raw = localStorage.getItem(DURATION_KEY);
  if (raw === null) return DURATION_DEFAULT;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < DURATION_MIN || parsed > DURATION_MAX) {
    return DURATION_DEFAULT;
  }
  return parsed;
}

function fireEndCue(): void {
  // Haptic pulse
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate([100, 50, 100]);
  }

  // Audio cue: 880 Hz sine for 300ms
  try {
    if (typeof AudioContext === 'undefined') return;

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = (): void => {
      void ctx.close();
    };
  } catch {
    // AudioContext not available — silently skip
  }
}

export function useRestTimer(): UseRestTimerReturn {
  const [duration, setDurationState] = useState<number>(readDuration);
  const [remaining, setRemaining] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const clearTimer = (): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startCountdown = (dur: number): void => {
    clearTimer();
    setRemaining(dur);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearTimer();
          setIsRunning(false);
          fireEndCue();
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  const start = (): void => {
    startCountdown(duration);
  };

  const startIfIdle = (): void => {
    if (isRunning || remaining > 0) return;
    startCountdown(duration);
  };

  const stop = (): void => {
    clearTimer();
    setRemaining(0);
    setIsRunning(false);
  };

  const setDuration = (seconds: number): void => {
    if (!Number.isInteger(seconds) || seconds < DURATION_MIN || seconds > DURATION_MAX) {
      return;
    }
    setDurationState(seconds);
    localStorage.setItem(DURATION_KEY, String(seconds));
  };

  return { remaining, isRunning, duration, start, startIfIdle, stop, setDuration };
}
