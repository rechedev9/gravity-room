import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clearApiResponseCache, setAccessToken, refreshAccessToken } from '@/lib/api';
import { apiFetch, fetchMe } from '@/lib/api-functions';
import { ApiError } from '@gzclp/api-client/api-error';
import { isRecord } from '@gzclp/domain/type-guards';
import { parseUserSafe } from '@gzclp/domain/schemas/user';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import { setUser as sentrySetUser } from '@/lib/sentry';
import { trackEvent } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResult {
  readonly message: string;
}

/** Result of an email/password action. `code` is the API error code for i18n. */
export interface ActionResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}

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
  readonly requestPasswordReset: (email: string) => Promise<ActionResult>;
  readonly resetPassword: (token: string, password: string) => Promise<ActionResult>;
  // DEV-only — undefined in production builds (esbuild dead-code-eliminates the branch).
  readonly signInWithDev?: () => Promise<AuthResult | null>;
  readonly signOut: () => Promise<void>;
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
  if (!refreshed) return null;
  try {
    // /auth/refresh returns the user alongside the token, so the common path
    // restores the session in one round-trip. Fall back to GET /auth/me only if
    // the payload is missing/unexpected (e.g. an older API without the field).
    const user = parseUserSafe(refreshed.user) ?? (await fetchMe());
    sentrySetUser({ id: user.id, email: user.email });
    return user;
  } catch (err: unknown) {
    // Never leave a valid-looking access token behind when its user payload
    // cannot be restored. Auth state and API credentials must move together.
    setAccessToken(null);
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
  data: unknown,
  setQueryData: (userInfo: UserInfo) => void,
  options: { readonly trackSignup: boolean }
): AuthResult | null {
  if (!isRecord(data) || typeof data.accessToken !== 'string') {
    return { message: 'Unexpected response from server' };
  }

  const userInfo = parseUserSafe(data.user);
  if (!userInfo) {
    setAccessToken(null);
    return { message: 'Unexpected response from server' };
  }

  setAccessToken(data.accessToken);
  setQueryData(userInfo);
  sentrySetUser({ id: userInfo.id, email: userInfo.email });
  if (options.trackSignup) trackEvent('signup');
  return null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const setSessionData = useCallback(
    (userInfo: UserInfo): void => {
      queryClient.setQueryData(SESSION_QUERY_KEY, userInfo);
    },
    [queryClient]
  );

  const signInWithGoogle = useCallback(
    async (credential: string): Promise<AuthResult | null> => {
      try {
        const data = await apiFetch('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential }),
        });
        return applySignInResponse(data, setSessionData, { trackSignup: true });
      } catch (err: unknown) {
        return { message: err instanceof Error ? err.message : 'Something went wrong' };
      }
    },
    [setSessionData]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      try {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const err = applySignInResponse(data, setSessionData, { trackSignup: false });
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
        await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
        });
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
        const data = await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        const err = applySignInResponse(data, setSessionData, { trackSignup: false });
        return err ? { ok: false, message: err.message } : { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    [setSessionData]
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<ActionResult> => {
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { ok: true };
    } catch (err: unknown) {
      return errorResult(err);
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string): Promise<ActionResult> => {
      try {
        await apiFetch('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        });
        return { ok: true };
      } catch (err: unknown) {
        return errorResult(err);
      }
    },
    []
  );

  const signInWithDevImpl = useCallback(async (): Promise<AuthResult | null> => {
    try {
      const data = await apiFetch('/auth/dev', {
        method: 'POST',
        headers: { 'x-dev-auth-secret': DEV_AUTH_SECRET },
        body: JSON.stringify({ email: 'dev@localhost.dev' }),
      });
      return applySignInResponse(data, setSessionData, { trackSignup: false });
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
    await apiFetch('/auth/me', { method: 'DELETE' });
    setAccessToken(null);
    await clearApiResponseCache();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    sentrySetUser(null);
  }, [queryClient]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/auth/signout', { method: 'POST' });
    } catch (err: unknown) {
      // Ignore signout errors — always clear local state
      console.warn(
        '[auth] Signout request failed (ignored):',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
    setAccessToken(null);
    await clearApiResponseCache();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    sentrySetUser(null);
  }, [queryClient]);

  const value = useMemo(
    (): AuthContextValue => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      verifyEmail,
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
