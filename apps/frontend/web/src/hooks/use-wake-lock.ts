import { useState, useEffect, useRef } from 'react';

interface UseWakeLockReturn {
  /** Whether the wake lock is currently active */
  readonly isActive: boolean;
  /** Whether the Wake Lock API is supported in this browser */
  readonly isSupported: boolean;
}

export function useWakeLock(enabled: boolean): UseWakeLockReturn {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!isSupported || !enabled) {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {
          // Release may fail if already released — safe to ignore
        });
        sentinelRef.current = null;
        setIsActive(false);
      }
      return;
    }

    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setIsActive(true);
        sentinel.addEventListener('release', () => {
          setIsActive(false);
          sentinelRef.current = null;
        });
      } catch (err: unknown) {
        // Wake lock request failed (e.g., low battery, permission denied)
        if (!cancelled) {
          setIsActive(false);
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[useWakeLock] Failed to acquire wake lock: ${message}`);
        }
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && !sentinelRef.current && !cancelled) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return (): void => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
        setIsActive(false);
      }
    };
  }, [enabled, isSupported]);

  return { isActive, isSupported };
}
