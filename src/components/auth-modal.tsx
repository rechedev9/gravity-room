'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface AuthModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps): React.ReactNode {
  if (!open) return null;
  return <AuthModalContent onClose={onClose} />;
}

type AuthMode = 'sign-in' | 'sign-up';

function AuthModalContent({ onClose }: { readonly onClose: () => void }): React.ReactNode {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 50);
    return (): void => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return (): void => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const authError =
      mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === 'sign-up') {
      setError('Check your email for a confirmation link.');
      return;
    }

    onClose();
  };

  const handleGoogle = async (): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle();
    if (authError) {
      setError(authError.message);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 min-h-[44px] text-sm bg-[var(--bg-body)] border-2 border-[var(--border-color)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--btn-border)] focus:outline-none';
  const primaryBtn =
    'w-full px-4 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const secondaryBtn =
    'w-full px-4 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] hover:bg-[var(--bg-hover-row)] transition-all';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 max-w-sm w-[calc(100%-2rem)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-[var(--text-header)] mb-4">
          {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </h3>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            ref={emailRef}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            minLength={6}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />

          {error && (
            <p className="text-xs text-[var(--text-error)] bg-[var(--bg-error)] border border-[var(--border-error)] px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className={primaryBtn} disabled={submitting}>
            {submitting ? 'Loading...' : mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>

        <button className={secondaryBtn} onClick={() => void handleGoogle()}>
          Continue with Google
        </button>

        <p className="text-[11px] text-[var(--text-muted)] text-center mt-4">
          {mode === 'sign-in' ? (
            <>
              No account?{' '}
              <button
                className="text-[var(--btn-text)] underline cursor-pointer bg-transparent border-none p-0 font-bold"
                onClick={() => {
                  setMode('sign-up');
                  setError(null);
                }}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                className="text-[var(--btn-text)] underline cursor-pointer bg-transparent border-none p-0 font-bold"
                onClick={() => {
                  setMode('sign-in');
                  setError(null);
                }}
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
