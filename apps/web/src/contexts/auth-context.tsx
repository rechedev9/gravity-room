import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setAccessToken, refreshAccessToken } from '@/lib/api';
import { apiFetch, fetchMe, parseUserSafe } from '@/lib/api-functions';
import type { UserInfo } from '@/lib/api-functions';
import { isRecord } from '@gzclp/shared/type-guards';
import { setUser as sentrySetUser } from '@/lib/sentry';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Re-export UserInfo so existing consumers don't need to update their imports
// ---------------------------------------------------------------------------

export type { UserInfo };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResult {
  readonly message: string;
}

interface AuthState {
  readonly user: UserInfo | null;
  readonly loading: boolean;
}

interface AuthActions {
  readonly signInWithGoogle: (credential: string) => Promise<AuthResult | null>;
  readonly signInWithDev: () => Promise<AuthResult | null>;
  readonly signOut: () => Promise<void>;
  readonly updateUser: (info: Partial<Pick<UserInfo, 'name' | 'avatarUrl'>>) => void;
  readonly deleteAccount: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

// ---------------------------------------------------------------------------
// Session query
// ---------------------------------------------------------------------------

const SESSION_QUERY_KEY = ['auth', 'session'] as const;

async function restoreSession(): Promise<UserInfo | null> {
  const token = await refreshAccessToken();
  if (!token) return null;
  try {
    const user = await fetchMe();
    sentrySetUser({ id: user.id, email: user.email });
    return user;
  } catch (err: unknown) {
    // Token may be invalid — user stays null
    console.warn(
      '[auth] Session restore failed:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return null;
  }
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

  const signInWithGoogle = async (credential: string): Promise<AuthResult | null> => {
    try {
      const data = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      if (isRecord(data) && typeof data.accessToken === 'string') {
        setAccessToken(data.accessToken);
        const userInfo = parseUserSafe(data.user);
        if (userInfo) {
          queryClient.setQueryData(SESSION_QUERY_KEY, userInfo);
          sentrySetUser({ id: userInfo.id, email: userInfo.email });
          trackEvent('signup');
        }
        return null;
      }
      return { message: 'Unexpected response from server' };
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Something went wrong' };
    }
  };

  const signInWithDev = async (): Promise<AuthResult | null> => {
    try {
      const data = await apiFetch('/auth/dev', {
        method: 'POST',
        body: JSON.stringify({ email: 'dev@localhost.dev' }),
      });
      if (isRecord(data) && typeof data.accessToken === 'string') {
        setAccessToken(data.accessToken);
        const userInfo = parseUserSafe(data.user);
        if (userInfo) {
          queryClient.setQueryData(SESSION_QUERY_KEY, userInfo);
          sentrySetUser({ id: userInfo.id, email: userInfo.email });
        }
        return null;
      }
      return { message: 'Unexpected response from server' };
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Something went wrong' };
    }
  };

  const updateUser = (info: Partial<Pick<UserInfo, 'name' | 'avatarUrl'>>): void => {
    queryClient.setQueryData(SESSION_QUERY_KEY, (prev: UserInfo | null | undefined) =>
      prev ? { ...prev, ...info } : prev
    );
  };

  const deleteAccount = async (): Promise<void> => {
    await apiFetch('/auth/me', { method: 'DELETE' });
    setAccessToken(null);
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    sentrySetUser(null);
  };

  const signOut = async (): Promise<void> => {
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
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    sentrySetUser(null);
  };

  const value: AuthContextValue = {
    user,
    loading,
    signInWithGoogle,
    signInWithDev,
    signOut,
    updateUser,
    deleteAccount,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
