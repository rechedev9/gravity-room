import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/auth-context';
import { sanitizeAuthError } from '@/lib/auth-errors';

export function LoginPage(): React.ReactNode {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (credential: string): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle(credential);
    if (authError) {
      setError(sanitizeAuthError(authError.message));
    }
  };

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
              Welcome
            </h2>
            <p className="mb-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              Sign in to sync your progress across devices
            </p>

            {/* Google OAuth */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={({ credential }) => {
                  if (credential) void handleGoogleSuccess(credential);
                }}
                onError={() => {
                  setError('Google sign-in failed. Please try again.');
                }}
                theme="filled_black"
                size="large"
              />
            </div>

            {/* Error display */}
            {error && (
              <div
                className="flex items-start gap-2 text-xs bg-[var(--bg-error)] border border-[var(--border-error)] px-3 py-2.5 mt-4"
                style={{ color: 'var(--text-error)' }}
              >
                <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                  &#9888;
                </span>
                <span>{error}</span>
              </div>
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
