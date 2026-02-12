'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

interface AuthState {
  readonly user: User | null;
  readonly loading: boolean;
  readonly configured: boolean;
}

interface AuthActions {
  readonly signUp: (email: string, password: string) => Promise<AuthError | null>;
  readonly signIn: (email: string, password: string) => Promise<AuthError | null>;
  readonly signInWithGoogle: () => Promise<AuthError | null>;
  readonly signOut: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactNode {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const configured = supabase !== null;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!supabase) return;

    const initAuth = async (): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return (): void => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!supabase) return { name: 'AuthError', message: 'Supabase not configured' } as AuthError;
      const { error } = await supabase.auth.signUp({ email, password });
      return error;
    },
    [supabase]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!supabase) return { name: 'AuthError', message: 'Supabase not configured' } as AuthError;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error;
    },
    [supabase]
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    if (!supabase) return { name: 'AuthError', message: 'Supabase not configured' } as AuthError;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error;
  }, [supabase]);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured, signUp, signIn, signInWithGoogle, signOut }),
    [user, loading, configured, signUp, signIn, signInWithGoogle, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
