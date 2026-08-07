import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  blockAuthRefresh,
  clearApiResponseCache,
  refreshAccessToken,
  resumeAuthRefresh,
  setAccessToken,
} from '@/lib/api';
import { SESSION_INVALIDATED_EVENT } from '@/lib/auth-events';
import { fetchMe } from '@/lib/api-functions';
import { ApiError } from '@gzclp/api-client/api-error';
import { parseUserSafe } from '@gzclp/domain/schemas/user';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import { setUser as sentrySetUser } from '@/lib/sentry';
import { trackEvent } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import {
  deleteAuthenticatedAccount,
  endAuthenticatedSession,
  resendEmailVerification,
  resetPasswordWithToken,
  sendPasswordResetEmail,
  signInAsDevelopmentUser,
  signInWithEmailCredentials,
  signInWithGoogleCredential,
  signUpWithEmailCredentials,
  verifyEmailToken,
  type AuthenticatedSession,
} from '@/features/auth/auth-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResult {
  readonly message: string;
}

/** Result of an email/password action. `code` is the API error code for i18n. */
export type ActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code?: string; readonly message?: string };

interface AuthState {
  readonly user: UserInfo | null;
  readonly loading: boolean;
}

interface AuthActions {
  readonly signInWithGoogle: (credential: string) => Promise<AuthResult | null>;
  readonly signInWithEmail: (email: string, password: string) => Promise<ActionResult>;
  readonly signUpWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<ActionResult>;
  readonly verifyEmail: (token: string) => Promise<ActionResult>;
  readonly resendVerification: (email: string) => Promise<ActionResult>;
  readonly requestPasswordReset: (email: string) => Promise<ActionResult>;
  readonly resetPassword: (token: string, password: string) => Promise<ActionResult>;
  // DEV-only — undefined in production builds (esbuild dead-code-eliminates the branch).
  readonly signInWithDev?: () => Promise<AuthResult | null>;
  readonly signOut: () => Promise<ActionResult>;
  readonly updateUser: (info: Partial<Pick<UserInfo, 'name' | 'avatarUrl'>>) => void;
  readonly deleteAccount: () => Promise<void>;
}

/** Normalizes a caught error into an ActionResult, preserving the API error code. */
function errorResult(err: unknown): ActionResult {
  if (err instanceof ApiError) return { ok: false, code: err.code, message: err.message };
  if (
    err instanceof TypeError ||
    (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'))
  ) {
    return { ok: false, code: 'NETWORK_ERROR', message: err.message };
  }
  return { ok: false, message: err instanceof Error ? err.message : 'Something went wrong' };
}

type AuthContextValue = AuthState & AuthActions;

/** Stable for one authenticated lifecycle; access-token rotation does not change it. */
export interface AuthSessionIdentity {
  readonly userId: string;
  readonly sessionId: string;
}

let activeAuthSessionIdentity: AuthSessionIdentity | null = null;
let nextAuthSessionId = 0;

function beginAuthSession(userId: string): void {
  nextAuthSessionId += 1;
  activeAuthSessionIdentity = { userId, sessionId: `auth-session-${nextAuthSessionId}` };
}

export function getAuthSessionIdentity(): AuthSessionIdentity | null {
  return activeAuthSessionIdentity;
}

// ---------------------------------------------------------------------------
// Session query key
// ---------------------------------------------------------------------------

const SESSION_QUERY_KEY = queryKeys.auth.session;

// DEV-only shared secret for POST /auth/dev. Must match the API's
// AUTH_DEV_ROUTE_SECRET. Defaults to the value the e2e suite uses
// (playwright.config.ts) so the in-app Dev Login works with zero config;
// override via VITE_DEV_AUTH_SECRET when the API runs a different secret.
// This whole sign-in path is dead-code-eliminated from production builds.
const DEV_AUTH_SECRET = import.meta.env.VITE_DEV_AUTH_SECRET ?? 'e2e-dev-secret-not-for-prod';

// ---------------------------------------------------------------------------
// Session restore
// ---------------------------------------------------------------------------

async function restoreSession(): Promise<UserInfo | null> {
  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    activeAuthSessionIdentity = null;
    return null;
  }
  try {
    // /auth/refresh returns the user alongside the token, so the common path
    // restores the session in one round-trip. Fall back to GET /auth/me only if
    // the payload is missing/unexpected (e.g. an older API without the field).
    const user = parseUserSafe(refreshed.user) ?? (await fetchMe());
    beginAuthSession(user.id);
    sentrySetUser({ id: user.id });
    return user;
  } catch (err: unknown) {
    // Never leave a valid-looking access token behind when its user payload
    // cannot be restored. Auth state and API credentials must move together.
    setAccessToken(null);
    activeAuthSessionIdentity = null;
    await clearApiResponseCache();
    console.warn(
      '[auth] Session restore failed:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared sign-in response handler (used by both Google and dev sign-in paths)
// ---------------------------------------------------------------------------

function applySignInResponse(
  session: AuthenticatedSession | null,
  setQueryData: (userInfo: UserInfo) => void,
  options: { readonly trackSignup: boolean }
): AuthResult | null {
  if (!session) {
    setAccessToken(null);
    activeAuthSessionIdentity = null;
    return { message: 'Unexpected response from server' };
  }

  setAccessToken(session.accessToken);
  beginAuthSession(session.user.id);
  // A successful sign-in starts a new refresh-token lifecycle. A previous
  // successful sign-out deliberately blocked refresh rotation, so release
  // that block before this account's access token can expire.
  resumeAuthRefresh();
  setQueryData(session.user);
  sentrySetUser({ id: session.user.id });
  if (options.trackSignup) trackEvent('signup');
  return null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Clears every user-bound client credential and cache after the server session
 * ends. React Query keys are intentionally not user-scoped, so retaining them
 * across logout/account deletion/password reset can expose the previous
 * account's programs or insights to the next account for up to staleTime.
 */
async function clearAuthenticatedClientState(queryClient: QueryClient): Promise<void> {
  setAccessToken(null);
  activeAuthSessionIdentity = null;
  try {
    await queryClient.cancelQueries();
  } catch (err: unknown) {
    console.warn(
      '[auth] Failed to cancel in-flight queries while clearing the session:',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
  });
  queryClient.setQueryData(SESSION_QUERY_KEY, null);
  sentrySetUser(null);
  try {
    await clearApiResponseCache();
  } catch (err: unknown) {
    console.warn(
      '[auth] Failed to clear the browser API cache:',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactNode {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: restoreSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const user = session.data ?? null;
  const loading = session.isPending;

  useEffect(() => {
    const handleSessionInvalidated = (): void => {
      void clearAuthenticatedClientState(queryClient);
    };
    window.addEventListener(SESSION_INVALIDATED_EVENT, handleSessionInvalidated);
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, handleSessionInvalidated);
  }, [queryClient]);

  const setSessionData = useCallback(
    (userInfo: UserInfo): void => {
      queryClient.setQueryData(SESSION_QUERY_KEY, userInfo);
    },
    [queryClient]
  );

  const signInWithGoogle = useCallback(
    async (credential: string): Promise<AuthResult | null> => {
      try {
        const session = await signInWithGoogleCredential(credential);
        return applySignInResponse(session, setSessionData, { trackSignup: true });
      } catch (err: unknown) {
        return { message: err instanceof Error ? err.message : 'Something went wrong' };
      }
    },
    [setSessionData]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      try {
        const session = await signInWithEmailCredentials(email, password);
        const err = applySignInResponse(session, setSessionData, { trackSignup: false });
        return err ? { ok: false, message: err.message } : { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    [setSessionData]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name?: string): Promise<ActionResult> => {
      try {
        await signUpWithEmailCredentials(email, password, name);
        trackEvent('signup');
        return { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    []
  );

  const verifyEmail = useCallback(
    async (token: string): Promise<ActionResult> => {
      try {
        const session = await verifyEmailToken(token);
        const err = applySignInResponse(session, setSessionData, { trackSignup: false });
        return err ? { ok: false, message: err.message } : { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    [setSessionData]
  );

  const resendVerification = useCallback(async (email: string): Promise<ActionResult> => {
    try {
      await resendEmailVerification(email);
      return { ok: true };
    } catch (err: unknown) {
      return errorResult(err);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<ActionResult> => {
    try {
      await sendPasswordResetEmail(email);
      return { ok: true };
    } catch (err: unknown) {
      return errorResult(err);
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string): Promise<ActionResult> => {
      try {
        await resetPasswordWithToken(token, password);
        await clearAuthenticatedClientState(queryClient);
        return { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    [queryClient]
  );

  const signInWithDevImpl = useCallback(async (): Promise<AuthResult | null> => {
    try {
      const session = await signInAsDevelopmentUser(DEV_AUTH_SECRET, 'dev@localhost.dev');
      return applySignInResponse(session, setSessionData, { trackSignup: false });
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Something went wrong' };
    }
  }, [setSessionData]);
  // Strip the dev sign-in entry-point in production. The /auth/dev API route
  // returns 404 in prod anyway, but removing the caller keeps it out of the
  // bundle entirely.
  const signInWithDev = import.meta.env.DEV ? signInWithDevImpl : undefined;

  const updateUser = useCallback(
    (info: Partial<Pick<UserInfo, 'name' | 'avatarUrl'>>): void => {
      queryClient.setQueryData(SESSION_QUERY_KEY, (prev: UserInfo | null | undefined) =>
        prev ? { ...prev, ...info } : prev
      );
    },
    [queryClient]
  );

  const deleteAccount = useCallback(async (): Promise<void> => {
    await deleteAuthenticatedAccount();
    await clearAuthenticatedClientState(queryClient);
  }, [queryClient]);

  const signOut = useCallback(async (): Promise<ActionResult> => {
    blockAuthRefresh();
    try {
      await endAuthenticatedSession();
    } catch (err: unknown) {
      // Keep the authenticated UI intact so the user can retry. In particular,
      // do not reload while an HttpOnly refresh cookie may still be valid.
      resumeAuthRefresh();
      return errorResult(err);
    }
    await clearAuthenticatedClientState(queryClient);
    return { ok: true };
  }, [queryClient]);

  const value = useMemo(
    (): AuthContextValue => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      signInWithDev,
      signOut,
      updateUser,
      deleteAccount,
    }),
    [
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      signInWithDev,
      signOut,
      updateUser,
      deleteAccount,
    ]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
