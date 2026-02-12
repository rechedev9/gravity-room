'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { sanitizeAuthError } from '@/lib/auth-errors';
import { checkLeakedPassword } from '@/lib/password-check';

type AuthMode = 'sign-in' | 'sign-up';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export function LoginPage(): React.ReactNode {
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // Decrement lockout countdown each second
  useEffect(() => {
    if (lockCountdown <= 0) return;
    const timer = setTimeout(() => {
      setLockCountdown((prev) => prev - 1);
    }, 1000);
    return (): void => {
      clearTimeout(timer);
    };
  }, [lockCountdown]);

  const isLocked = lockCountdown > 0;

  useEffect(() => {
    if (user) {
      router.push('/app');
    }
  }, [user, router]);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (mode === 'sign-up') {
      const isLeaked = await checkLeakedPassword(password);
      if (isLeaked) {
        setSubmitting(false);
        setError('This password has appeared in a data breach. Please choose a different one.');
        return;
      }
    }

    const authError =
      mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);

    if (authError) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= MAX_ATTEMPTS) {
        const lockSeconds = LOCKOUT_MS / 1000;
        setLockCountdown(lockSeconds);
        setAttempts(0);
        setError(`Too many failed attempts. Try again in ${lockSeconds} seconds.`);
      } else {
        setError(sanitizeAuthError(authError.message));
      }
      return;
    }

    setAttempts(0);
    if (mode === 'sign-up') {
      setSuccess('Check your email for a confirmation link.');
      return;
    }
  };

  const handleGoogle = async (): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle();
    if (authError) {
      setError(sanitizeAuthError(authError.message));
    }
  };

  const inputClass =
    'w-full px-4 py-3 min-h-[48px] text-sm bg-[var(--bg-body)] border-2 border-[var(--border-color)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--btn-border)] focus:outline-none transition-colors';
  const primaryBtn =
    'w-full px-4 py-3 min-h-[48px] text-sm font-bold cursor-pointer border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const googleBtn =
    'w-full px-4 py-3 min-h-[48px] text-sm font-bold cursor-pointer border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--border-light)] hover:bg-[var(--bg-hover-row)] transition-all flex items-center justify-center gap-3';

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg-body)]">
      {/* Header */}
      <header className="text-center py-8 sm:py-12 px-5 bg-[var(--bg-header)]">
        <Image
          src="/logo.webp"
          alt="RSN logo"
          width={80}
          height={80}
          className="mx-auto mb-3 rounded-full"
          priority
        />
        <h1 className="text-[22px] sm:text-[28px] font-extrabold tracking-tight text-[var(--text-header)] mb-1.5">
          The Real Hiperbolic Time Chamber
        </h1>
        <p className="text-[13px] text-[var(--text-header)] opacity-70">
          Train smarter. Progress faster.
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-[420px]">
          {/* Auth card */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <h2 className="text-lg font-bold text-[var(--text-header)] mb-1">
              {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              {mode === 'sign-in'
                ? 'Sign in to sync your progress across devices'
                : 'Start tracking your training progress in the cloud'}
            </p>

            {/* Google OAuth */}
            <button className={googleBtn} onClick={() => void handleGoogle()}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--border-color)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                or
              </span>
              <div className="flex-1 h-px bg-[var(--border-color)]" />
            </div>

            {/* Email form */}
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[11px] font-bold uppercase tracking-wide text-[var(--text-label)] mb-1.5"
                >
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-bold uppercase tracking-wide text-[var(--text-label)] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={mode === 'sign-up' ? 'Min 6 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />
                {mode === 'sign-up' && password.length > 0 && password.length < 6 && (
                  <p className="text-[11px] text-[var(--text-error)] mt-1">
                    Password must be at least 6 characters.
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-[var(--text-error)] bg-[var(--bg-error)] border border-[var(--border-error)] px-3 py-2.5">
                  <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                    &#9888;
                  </span>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 text-xs text-[var(--text-badge-ok)] bg-[var(--bg-badge-ok)] border border-[var(--border-badge-ok)] px-3 py-2.5">
                  <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                    &#10003;
                  </span>
                  <span>{success}</span>
                </div>
              )}

              <button type="submit" className={primaryBtn} disabled={submitting || isLocked}>
                {isLocked
                  ? `Locked (${lockCountdown}s)`
                  : submitting
                    ? 'Loading...'
                    : mode === 'sign-in'
                      ? 'Sign In'
                      : 'Create Account'}
              </button>
            </form>

            {/* Toggle mode */}
            <p className="text-xs text-[var(--text-muted)] text-center mt-5">
              {mode === 'sign-in' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    className="text-[var(--btn-text)] font-bold underline cursor-pointer bg-transparent border-none p-0"
                    onClick={() => {
                      setMode('sign-up');
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="text-[var(--btn-text)] font-bold underline cursor-pointer bg-transparent border-none p-0"
                    onClick={() => {
                      setMode('sign-in');
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Continue without account */}
          <div className="text-center mt-6">
            <Link
              href="/app"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors underline underline-offset-2"
            >
              Continue without an account
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg mb-1 text-[var(--text-header)]">&#9729;</div>
              <p className="text-[11px] font-bold text-[var(--text-main)] mb-0.5">Cloud Sync</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                Access your data from any device
              </p>
            </div>
            <div>
              <div className="text-lg mb-1 text-[var(--text-header)]">&#9889;</div>
              <p className="text-[11px] font-bold text-[var(--text-main)] mb-0.5">Offline First</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                Works without internet, syncs later
              </p>
            </div>
            <div>
              <div className="text-lg mb-1 text-[var(--text-header)]">&#128274;</div>
              <p className="text-[11px] font-bold text-[var(--text-main)] mb-0.5">Secure</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                Your data is private and encrypted
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
