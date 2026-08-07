import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import type { AuthUser, SessionState } from '../lib/auth/session';
import {
  restoreSession,
  signInWithDev,
  signInWithEmailPassword,
  signInWithGoogleIdToken,
  signOutSession,
  signUpWithEmailPassword,
} from '../lib/auth/session';
import {
  clearLocalSession,
  createSessionTransitionCoordinator,
  flushLocalSessionMutations,
  prepareLocalSession,
  publishLocalSession,
  type SessionTransition,
} from '../lib/auth/session-lifecycle';

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
  /**
   * DEV-only cookie session via POST /auth/dev. Undefined outside __DEV__ so
   * production UI never surfaces the control.
   */
  readonly signInWithDev?: () => Promise<AuthActionResult>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function establishLocalSession(
  session: SessionState,
  transition: SessionTransition
): Promise<boolean> {
  if (!transition.isCurrent()) {
    return false;
  }

  const prepared = await prepareLocalSession(session.user.id, transition);
  if (!prepared || !transition.isCurrent()) {
    return false;
  }

  return publishLocalSession(session, transition);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitionCoordinator] = useState(createSessionTransitionCoordinator);

  useEffect(() => {
    let active = true;
    const transition = transitionCoordinator.begin();

    void transition
      .runExclusive(async () => {
        if (!active || !transition.isCurrent()) return;

        const session = await restoreSession();
        if (!active || !transition.isCurrent()) return;
        if (!session) {
          setUser(null);
          return;
        }

        const established = await establishLocalSession(session, transition);
        if (active && established && transition.isCurrent()) {
          setUser(session.user);
        }
      })
      .catch(() => {
        if (!active || !transition.isCurrent()) return;
        setUser(null);
      })
      .finally(() => {
        if (!active || !transition.isCurrent()) return;
        setLoading(false);
      });

    return () => {
      active = false;
      transitionCoordinator.invalidate();
    };
  }, [transitionCoordinator]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void flushLocalSessionMutations().catch(() => {
        // Keep the outbox intact for a later foreground or explicit retry.
      });
    });

    return () => subscription.remove();
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isGuest: false,
      signInWithGoogle: async (credential: string) => {
        const transition = transitionCoordinator.begin();
        await transition.runExclusive(async () => {
          if (!transition.isCurrent()) return;

          try {
            const session = await signInWithGoogleIdToken(credential);
            if (!transition.isCurrent()) return;

            const established = await establishLocalSession(session, transition);
            if (established && transition.isCurrent()) {
              setUser(session.user);
              setLoading(false);
            }
          } catch (error: unknown) {
            if (transition.isCurrent()) {
              throw error;
            }
          }
        });
      },
      signInWithEmail: async (email: string, password: string): Promise<AuthActionResult> => {
        const transition = transitionCoordinator.begin();
        return transition.runExclusive(async (): Promise<AuthActionResult> => {
          if (!transition.isCurrent()) return { ok: true };

          try {
            const result = await signInWithEmailPassword(email, password);
            if (!transition.isCurrent()) return { ok: true };
            if (!result.ok) {
              setLoading(false);
              return { ok: false, code: result.code };
            }

            const established = await establishLocalSession(result.session, transition);
            if (established && transition.isCurrent()) {
              setUser(result.session.user);
              setLoading(false);
            }
            return { ok: true };
          } catch (error: unknown) {
            if (!transition.isCurrent()) return { ok: true };
            throw error;
          }
        });
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
      ...(typeof __DEV__ !== 'undefined' && __DEV__
        ? {
            signInWithDev: async (): Promise<AuthActionResult> => {
              const transition = transitionCoordinator.begin();
              return transition.runExclusive(async (): Promise<AuthActionResult> => {
                if (!transition.isCurrent()) return { ok: true };

                try {
                  const result = await signInWithDev();
                  if (!transition.isCurrent()) return { ok: true };
                  if (!result.ok) {
                    setLoading(false);
                    return { ok: false, code: result.code };
                  }

                  const established = await establishLocalSession(result.session, transition);
                  if (established && transition.isCurrent()) {
                    setUser(result.session.user);
                    setLoading(false);
                  }
                  return { ok: true };
                } catch (error: unknown) {
                  if (!transition.isCurrent()) return { ok: true };
                  throw error;
                }
              });
            },
          }
        : {}),
      signOut: async () => {
        const transition = transitionCoordinator.begin();
        await transition.runExclusive(async () => {
          if (!transition.isCurrent()) return;

          try {
            // Durable credential deletion is the sign-out boundary. If SecureStore
            // cannot remove either credential, reject without changing user/access
            // state so the profile can display an error and let the user retry.
            await signOutSession();
            if (!transition.isCurrent()) return;

            // Credentials are now durably gone. Local cleanup is best-effort but
            // preserves the owner marker if isolation cannot be completed.
            await clearLocalSession();
            if (!transition.isCurrent()) return;

            setUser(null);
            setLoading(false);
          } catch (error: unknown) {
            if (transition.isCurrent()) {
              throw error;
            }
          }
        });
      },
    }),
    [loading, transitionCoordinator, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
