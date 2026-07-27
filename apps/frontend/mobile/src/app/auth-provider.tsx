import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import type { AuthUser } from '../lib/auth/session';
import {
  getAccessToken,
  restoreSession,
  signInWithEmailPassword,
  signInWithGoogleIdToken,
  signOutSession,
  signUpWithEmailPassword,
} from '../lib/auth/session';
import { secureLocalDataOwnerStorage } from '../lib/auth/secure-storage';
import { clearLocalAppData } from '../lib/db/client';
import { clearQueuedMutations, flushQueuedMutations } from '../lib/sync/mutation-sync-service';

/**
 * Result of an email/password action. `code` is the API error code (or a
 * status-derived fallback) the login screen maps to a localized message.
 */
export interface AuthActionResult {
  readonly ok: boolean;
  readonly code?: string;
}

interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  // Guest mode is out of scope for this phase (web guest semantics are being
  // reworked). The flag is reserved here so a future guest provider can flip it
  // without changing this context's shape or its consumers.
  readonly isGuest: boolean;
  readonly signInWithGoogle: (credential: string) => Promise<void>;
  readonly signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  readonly signUpWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<AuthActionResult>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function prepareLocalDataForUser(
  userId: string,
  preserveUnclaimedData: boolean
): Promise<void> {
  const ownerId = await secureLocalDataOwnerStorage.getOwnerId();
  if (ownerId !== userId && !(ownerId === null && preserveUnclaimedData)) {
    await clearQueuedMutations();
    await clearLocalAppData();
  }
  await secureLocalDataOwnerStorage.setOwnerId(userId);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void restoreSession()
      .then((session) => {
        if (!active) return;
        if (!session) {
          setUser(null);
          return;
        }

        return prepareLocalDataForUser(session.user.id, true).then(() => {
          if (!active) return;
          setUser(session.user);
          void flushQueuedMutations(session.accessToken).catch(() => {
            // Leave queued mutations in place for a later retry.
          });
        });
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

  useEffect(() => {
    if (!user) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      const currentAccessToken = getAccessToken();
      if (currentAccessToken) {
        void flushQueuedMutations(currentAccessToken).catch(() => {
          // Keep the outbox intact for a later foreground or explicit retry.
        });
      }
    });

    return () => subscription.remove();
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isGuest: false,
      signInWithGoogle: async (credential: string) => {
        const session = await signInWithGoogleIdToken(credential);
        await prepareLocalDataForUser(session.user.id, false);
        setUser(session.user);
        void flushQueuedMutations(session.accessToken).catch(() => {
          // Leave queued mutations in place for a later retry.
        });
      },
      signInWithEmail: async (email: string, password: string): Promise<AuthActionResult> => {
        const result = await signInWithEmailPassword(email, password);
        if (!result.ok) {
          return { ok: false, code: result.code };
        }
        await prepareLocalDataForUser(result.session.user.id, false);
        setUser(result.session.user);
        void flushQueuedMutations(result.session.accessToken).catch(() => {
          // Leave queued mutations in place for a later retry.
        });
        return { ok: true };
      },
      signUpWithEmail: async (
        email: string,
        password: string,
        name?: string
      ): Promise<AuthActionResult> => {
        const result = await signUpWithEmailPassword(email, password, name);
        // Sign-up never authenticates: the account must verify its email first.
        return result.ok ? { ok: true } : { ok: false, code: result.code };
      },
      signOut: async () => {
        await clearQueuedMutations().catch(() => {
          // Best-effort cleanup only; local queue issues must not block sign-out.
        });
        await signOutSession();
        await clearLocalAppData().catch(() => {
          // Best-effort cleanup only; local cache issues must not block sign-out.
        });
        await secureLocalDataOwnerStorage.clearOwnerId().catch(() => {
          // Best-effort cleanup only; cache deletion above already prevents
          // another account from observing this user's local data.
        });
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
