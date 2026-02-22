import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { setAccessToken, refreshAccessToken } from '@/lib/api';
import { apiFetch, importProgram } from '@/lib/api-functions';
import { isRecord } from '@gzclp/shared/type-guards';
import {
  readGuestData,
  writeGuestData,
  clearGuestData,
  createEmptyGuestMap,
} from '@/lib/guest-storage';

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
  readonly isGuest: boolean;
}

interface AuthActions {
  readonly signInWithGoogle: (credential: string) => Promise<AuthResult | null>;
  readonly signOut: () => Promise<void>;
  readonly startGuestSession: () => void;
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
// Guest promotion helper
// ---------------------------------------------------------------------------

/** Imports all guest instances into the authenticated account and clears guest data. */
async function promoteGuestData(): Promise<void> {
  const guestData = readGuestData();
  if (!guestData) return;

  for (const instance of Object.values(guestData.instances)) {
    try {
      await importProgram({
        version: 1,
        exportDate: new Date().toISOString(),
        programId: instance.programId,
        name: instance.name,
        config: instance.config,
        results: instance.results,
        undoHistory: instance.undoHistory,
      });
    } catch (err: unknown) {
      console.warn(
        '[auth] Guest instance promotion failed:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  clearGuestData();
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
  const [isGuest, setIsGuest] = useState(false);

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

  const startGuestSession = useCallback((): void => {
    writeGuestData(createEmptyGuestMap());
    setIsGuest(true);
  }, []);

  const signInWithGoogle = useCallback(async (credential: string): Promise<AuthResult | null> => {
    try {
      const data = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      if (isRecord(data) && typeof data.accessToken === 'string') {
        setAccessToken(data.accessToken);

        // Guest → account promotion: import any guest data before setting user
        await promoteGuestData();

        setIsGuest(false);
        const userInfo = parseUserInfo(data.user);
        if (userInfo) setUser(userInfo);
        return null;
      }
      return { message: 'Unexpected response from server' };
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Something went wrong' };
    }
  }, []);

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
    setUser(null);
    setIsGuest(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: true,
      isGuest,
      signInWithGoogle,
      signOut,
      startGuestSession,
    }),
    [user, loading, isGuest, signInWithGoogle, signOut, startGuestSession]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
