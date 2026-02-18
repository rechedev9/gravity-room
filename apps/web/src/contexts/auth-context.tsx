import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { setAccessToken, refreshAccessToken } from '@/lib/api';
import { apiFetch } from '@/lib/api-functions';
import { isRecord } from '@gzclp/shared/type-guards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserInfo {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
}

interface AuthResult {
  readonly message: string;
}

interface AuthState {
  readonly user: UserInfo | null;
  readonly loading: boolean;
  readonly configured: boolean;
}

interface AuthActions {
  readonly signUp: (email: string, password: string) => Promise<AuthResult | null>;
  readonly signIn: (email: string, password: string) => Promise<AuthResult | null>;
  readonly signOut: () => Promise<void>;
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
        if (userInfo) setUser(userInfo);
      } catch {
        // Token may be invalid — user stays null
      }

      setLoading(false);
    };

    void restore();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult | null> => {
      try {
        const data = await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (isRecord(data) && typeof data.accessToken === 'string') {
          setAccessToken(data.accessToken);
          const userInfo = parseUserInfo(isRecord(data) ? data.user : null);
          if (userInfo) setUser(userInfo);
        }
        return null;
      } catch (err: unknown) {
        return { message: err instanceof Error ? err.message : 'Something went wrong' };
      }
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult | null> => {
      try {
        const data = await apiFetch('/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (isRecord(data) && typeof data.accessToken === 'string') {
          setAccessToken(data.accessToken);
          const userInfo = parseUserInfo(isRecord(data) ? data.user : null);
          if (userInfo) setUser(userInfo);
        }
        return null;
      } catch (err: unknown) {
        return { message: err instanceof Error ? err.message : 'Something went wrong' };
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/auth/signout', { method: 'POST' });
    } catch {
      // Ignore signout errors — always clear local state
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: true,
      signUp,
      signIn,
      signOut,
    }),
    [user, loading, signUp, signIn, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
