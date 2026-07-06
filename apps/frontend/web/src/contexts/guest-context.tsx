import { createContext, useCallback, useContext, useState } from 'react';
import { clearGuestData, setGuestMigrationMarker } from '@/lib/guest-storage';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestContextValue {
  readonly isGuest: boolean;
  readonly enterGuestMode: () => void;
  /** Leaves guest mode AND discards any on-device guest program data. */
  readonly exitGuestMode: () => void;
  /**
   * Leaves guest mode but PRESERVES the on-device guest program data. Used by
   * the "Create Account" flow: the data must survive the trip to /login so it
   * can be migrated to the account after sign-in (see lib/guest-migration.ts).
   */
  readonly exitGuestModeKeepingData: () => void;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

// Guest mode must survive a page reload — otherwise the router guard
// (see router.tsx) treats an unauthenticated, non-guest user as logged out
// and redirects to /login, discarding any in-progress guest workout.
const GUEST_MODE_STORAGE_KEY = 'gravity-room:guest-mode';

/**
 * Reads the persisted guest-mode flag directly from localStorage. Router
 * guards use this instead of (only) the React context value: enterGuestMode /
 * exitGuestModeKeepingData write the flag synchronously, while the context
 * value reaches the router one render later - reading the flag here keeps a
 * same-tick navigate() from being bounced by a stale guard.
 */
export function readStoredIsGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GuestContext = createContext<GuestContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GuestProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactNode {
  const [isGuest, setIsGuest] = useState<boolean>(readStoredIsGuest);

  const enterGuestMode = useCallback((): void => {
    // The analytics event lives here so every entry point (login page, landing
    // CTA, future surfaces) counts guest starts without remembering to track.
    trackEvent('guest_start');
    setIsGuest(true);
    try {
      localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors — guest mode still works for this tab session
    }
  }, []);

  const clearGuestModeFlag = useCallback((): void => {
    setIsGuest(false);
    try {
      localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const exitGuestMode = useCallback((): void => {
    clearGuestModeFlag();
    // Guest data must not leak into a later real (or new guest) session.
    clearGuestData();
  }, [clearGuestModeFlag]);

  const exitGuestModeKeepingData = useCallback((): void => {
    // Deliberately does NOT clear guest data - the "Create Account" flow relies
    // on it surviving to be migrated after sign-in (see lib/guest-migration.ts).
    // The marker scopes that migration to this intent: without a fresh marker,
    // leftover guest data is purged rather than imported into whichever
    // account signs in next on this browser.
    setGuestMigrationMarker();
    clearGuestModeFlag();
  }, [clearGuestModeFlag]);

  const value: GuestContextValue = {
    isGuest,
    enterGuestMode,
    exitGuestMode,
    exitGuestModeKeepingData,
  };

  return <GuestContext value={value}>{children}</GuestContext>;
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function useGuest(): GuestContextValue {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error('useGuest must be used within GuestProvider');
  return ctx;
}
