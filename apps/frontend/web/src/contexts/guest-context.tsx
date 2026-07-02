import { createContext, useCallback, useContext, useState } from 'react';
import { clearGuestData } from '@/lib/guest-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestContextValue {
  readonly isGuest: boolean;
  readonly enterGuestMode: () => void;
  readonly exitGuestMode: () => void;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

// Guest mode must survive a page reload — otherwise the router guard
// (see router.tsx) treats an unauthenticated, non-guest user as logged out
// and redirects to /login, discarding any in-progress guest workout.
const GUEST_MODE_STORAGE_KEY = 'gravity-room:guest-mode';

function readStoredIsGuest(): boolean {
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
    setIsGuest(true);
    try {
      localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors — guest mode still works for this tab session
    }
  }, []);

  const exitGuestMode = useCallback((): void => {
    setIsGuest(false);
    try {
      localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    // Guest data must not leak into a later real (or new guest) session.
    clearGuestData();
  }, []);

  const value: GuestContextValue = {
    isGuest,
    enterGuestMode,
    exitGuestMode,
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
