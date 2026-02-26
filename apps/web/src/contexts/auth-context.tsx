import { createContext, useContext, useEffect, useState } from 'react';
import { setAccessToken, refreshAccessToken } from '@/lib/api';
import { apiFetch } from '@/lib/api-functions';
import { isRecord } from '@gzclp/shared/type-guards';
import { setUser as sentrySetUser } from '@/lib/sentry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserInfo {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly avatarUrl?: string;
}

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
// Helpers
// ---------------------------------------------------------------------------

function parseUserInfo(data: unknown): UserInfo | null {
  if (!isRecord(data)) return null;
  if (typeof data.id !== 'string' || typeof data.email !== 'string') return null;
  return {
    id: data.id,
    email: data.email,
    ...(typeof data.name === 'string' ? { name: data.name } : {}),
    ...(typeof data.avatarUrl === 'string' ? { avatarUrl: data.avatarUrl } : {}),
  };
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
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt to restore session from refresh cookie on mount
  useEffect(() => {
    const restore = async (): Promise<void> => {
      const token = await refreshAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch('/auth/me');
        const userInfo = parseUserInfo(data);
        if (userInfo) {
          setUser(userInfo);
          sentrySetUser({ id: userInfo.id, email: userInfo.email });
        }
      } catch (err: unknown) {
        // Token may be invalid — user stays null
        console.warn(
          '[auth] Session restore failed:',
          err instanceof Error ? err.message : 'Unknown error'
        );
      }

      setLoading(false);
    };

    void restore();
  }, []);

  const signInWithGoogle = async (credential: string): Promise<AuthResult | null> => {
    try {
      const data = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      if (isRecord(data) && typeof data.accessToken === 'string') {
        setAccessToken(data.accessToken);
        const userInfo = parseUserInfo(data.user);
        if (userInfo) {
          setUser(userInfo);
          sentrySetUser({ id: userInfo.id, email: userInfo.email });
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
        const userInfo = parseUserInfo(data.user);
        if (userInfo) {
          setUser(userInfo);
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
    setUser((prev) => (prev ? { ...prev, ...info } : prev));
  };

  const deleteAccount = async (): Promise<void> => {
    await apiFetch('/auth/me', { method: 'DELETE' });
    setAccessToken(null);
    setUser(null);
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
    setUser(null);
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
