import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './button';
import { sanitizeAuthError } from '@/lib/auth-errors';
import { checkLeakedPassword } from '@/lib/password-check';
import { useRateLimit } from '@/hooks/use-rate-limit';

type AuthMode = 'sign-in' | 'sign-up';

function submitButtonLabel(
  isLocked: boolean,
  lockCountdown: number,
  submitting: boolean,
  mode: AuthMode
): string {
  if (isLocked) return `Locked (${lockCountdown}s)`;
  if (submitting) return 'Loading...';
  if (mode === 'sign-in') return 'Sign In';
  return 'Create Account';
}

export function LoginPage(): React.ReactNode {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'signup' ? 'sign-up' : 'sign-in'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isLocked, lockCountdown, recordFailure, resetAttempts } = useRateLimit(5, 60_000);
  const emailRef = useRef<HTMLInputElement>(null);

  const switchMode = useCallback(
    (next: AuthMode): void => {
      setMode(next);
      setError(null);
      setSuccess(null);
      navigate(next === 'sign-up' ? '/login?mode=signup' : '/login', { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

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
      const lockoutMessage = recordFailure();
      setError(lockoutMessage ?? sanitizeAuthError(authError.message));
      return;
    }

    resetAttempts();
  };

  const handleGoogle = (): void => {
    setError(null);
    setSuccess('Google sign-in is coming soon. Please use email for now.');
  };

  const inputClass =
    'w-full px-4 py-3 min-h-[48px] bg-[var(--bg-body)] border-2 border-[var(--border-color)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--btn-border)] focus:outline-none transition-colors';

  const googleBtn =
    'w-full px-4 py-3 min-h-[48px] font-bold cursor-pointer border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--border-light)] hover:bg-[var(--bg-hover-row)] transition-all flex items-center justify-center gap-3';

  return (
    <div className="grain-overlay min-h-dvh flex flex-col bg-[var(--bg-body)]">
      {/* Header */}
      <header className="text-center pt-10 pb-8 px-5 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
        <img
          src="/logo.webp"
          alt="RSN logo"
          width={64}
          height={64}
          className="mx-auto mb-4 rounded-full"
        />
        <h1
          className="font-display mb-1 leading-none"
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            color: 'var(--text-header)',
          }}
        >
          The Real Hyperbolic Time Chamber
        </h1>
        <p
          className="font-mono text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Train smarter. Progress faster.
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[420px]">
          {/* Auth card */}
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 sm:p-8"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          >
            {/* Card heading */}
            <h2
              className="font-display leading-none mb-1"
              style={{
                fontSize: '32px',
                color: 'var(--text-header)',
              }}
            >
              {mode === 'sign-in' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="mb-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              {mode === 'sign-in'
                ? 'Sign in to sync your progress across devices'
                : 'Start tracking your training progress in the cloud'}
            </p>

            {/* Google OAuth */}
            <button className={googleBtn} onClick={handleGoogle} style={{ fontSize: '14px' }}>
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
              <span
                className="font-mono text-[10px] tracking-[0.25em] uppercase"
                style={{ color: 'var(--text-muted)' }}
              >
                or
              </span>
              <div className="flex-1 h-px bg-[var(--border-color)]" />
            </div>

            {/* Email form */}
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="font-mono block text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: 'var(--text-label)' }}
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
                  style={{ fontSize: '14px' }}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="font-mono block text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: 'var(--text-label)' }}
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={mode === 'sign-up' ? 'Min 8 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  style={{ fontSize: '14px' }}
                  required
                  minLength={8}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />
                {mode === 'sign-up' && password.length > 0 && password.length < 8 && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-error)' }}>
                    Password must be at least 8 characters.
                  </p>
                )}
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 text-xs bg-[var(--bg-error)] border border-[var(--border-error)] px-3 py-2.5"
                  style={{ color: 'var(--text-error)' }}
                >
                  <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                    &#9888;
                  </span>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  className="flex items-start gap-2 text-xs bg-[var(--bg-badge-ok)] border border-[var(--border-badge-ok)] px-3 py-2.5"
                  style={{ color: 'var(--text-badge-ok)' }}
                >
                  <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                    &#10003;
                  </span>
                  <span>{success}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={submitting || isLocked}>
                {submitButtonLabel(isLocked, lockCountdown, submitting, mode)}
              </Button>
            </form>

            {/* Toggle mode */}
            <p className="text-xs text-center mt-5" style={{ color: 'var(--text-muted)' }}>
              {mode === 'sign-in' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    className="font-bold underline cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--btn-text)' }}
                    onClick={() => switchMode('sign-up')}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="font-bold underline cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--btn-text)' }}
                    onClick={() => switchMode('sign-in')}
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>

            {/* Forgot password (sign-in only) */}
            {mode === 'sign-in' && (
              <p className="text-center mt-3">
                <Link
                  to="/forgot-password"
                  className="text-[11px] hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Forgot password?
                </Link>
              </p>
            )}
          </div>

          {/* Continue without account */}
          <div className="text-center mt-5">
            <Link
              to="/app?view=programs"
              className="text-[11px] underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              Continue without an account
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="mt-8 grid grid-cols-3 gap-px bg-[var(--border-color)]">
            {[
              { icon: '☁', label: 'Cloud Sync', desc: 'Access from any device' },
              { icon: '⚡', label: 'Auto-Save', desc: 'Every result saved instantly' },
              { icon: '🔒', label: 'Secure', desc: 'Private and encrypted' },
            ].map((f) => (
              <div key={f.label} className="bg-[var(--bg-card)] text-center py-4 px-3">
                <div className="text-base mb-1.5" style={{ color: 'var(--text-header)' }}>
                  {f.icon}
                </div>
                <p
                  className="font-mono text-[10px] font-bold uppercase tracking-wider mb-0.5"
                  style={{ color: 'var(--text-main)' }}
                >
                  {f.label}
                </p>
                <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
