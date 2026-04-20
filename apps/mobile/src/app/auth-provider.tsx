import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AuthUser } from '../lib/auth/session';
import { clearSession, restoreSession } from '../lib/auth/session';
import { clearLocalAppData } from '../lib/db/client';
import { clearQueuedMutations, flushQueuedMutations } from '../lib/sync/mutation-sync-service';

interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void restoreSession()
      .then((session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        if (session?.accessToken) {
          void flushQueuedMutations(session.accessToken).catch(() => {
            // Leave queued mutations in place for a later retry.
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut: async () => {
        await clearQueuedMutations().catch(() => {
          // Best-effort cleanup only; local queue issues must not block sign-out.
        });
        await clearLocalAppData().catch(() => {
          // Best-effort cleanup only; local cache issues must not block sign-out.
        });
        await clearSession();
        setUser(null);
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
