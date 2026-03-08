import { createContext, useContext, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestContextValue {
  readonly isGuest: boolean;
  readonly enterGuestMode: () => void;
  readonly exitGuestMode: () => void;
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
  const [isGuest, setIsGuest] = useState(false);

  const enterGuestMode = (): void => {
    setIsGuest(true);
  };

  const exitGuestMode = (): void => {
    setIsGuest(false);
  };

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
