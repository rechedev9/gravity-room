import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface UseSignOutResult {
  readonly signOut: () => Promise<void>;
  readonly pending: boolean;
  readonly failed: boolean;
}

/** Shared by the sidebar, the avatar menu and the More page so sign-out behaves the same everywhere. */
export function useSignOut(): UseSignOutResult {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const result = await signOut();
    if (!result.ok) {
      setFailed(true);
      setPending(false);
      return;
    }
    // A full replacement guarantees the protected tree is torn down and the next boot
    // re-checks the now-cleared refresh cookie. A same-tick SPA navigation can still see
    // the router's previous auth context and bounce straight back to /app.
    window.location.replace('/login');
  }, [pending, signOut]);

  return { signOut: run, pending, failed };
}
