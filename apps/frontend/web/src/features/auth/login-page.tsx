import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { sanitizeAuthError } from '@/lib/auth-errors';
import { trackEvent } from '@/lib/analytics';
import { Kicker } from '@/components/kicker';
import { CornerTicks } from '@/components/corner-ticks';

const EST_LINE = 'EST. 2025 · OPEN SOURCE · AGPL-3.0';

export function LoginPage(): React.ReactNode {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <LoginPageInner />
    </GoogleOAuthProvider>
  );
}

function LoginPageInner(): React.ReactNode {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithDev, user, loading } = useAuth();
  const { enterGuestMode, isGuest } = useGuest();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(t('login.page.title'));

  // Redirect away from /login once session restore completes with an authenticated user.
  // beforeLoad only runs once at navigation time; this handles the async restore case.
  useEffect(() => {
    if (!loading && (user !== null || isGuest)) {
      void navigate({ to: '/app' });
    }
  }, [loading, user, isGuest, navigate, t]);

  const loginTracked = useRef(false);
  useEffect(() => {
    if (loginTracked.current || loading || user !== null || isGuest) return;
    loginTracked.current = true;
    trackEvent('login_page_view');
  }, [loading, user, isGuest]);

  const handleGoogleSuccess = async (credential: string): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle(credential);
    if (authError) {
      setError(t(sanitizeAuthError(authError.message)));
    } else {
      void navigate({ to: '/app' });
    }
  };

  const handleGuestEntry = (): void => {
    trackEvent('guest_start');
    enterGuestMode();
    void navigate({ to: '/app' });
  };

  const handleDevLogin = async (): Promise<void> => {
    if (!signInWithDev) return;
    setError(null);
    const authError = await signInWithDev();
    if (authError) {
      setError(t(sanitizeAuthError(authError.message)));
    } else {
      void navigate({ to: '/app' });
    }
  };

  return (
    <div className="grain-overlay min-h-dvh bg-body lg:grid lg:grid-cols-[46%_54%]">
      {/* Left — statement panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-rule p-12 lg:flex">
        <img
          src="/landing-hero-bg.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18] grayscale"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, var(--color-body) 0%, transparent 35%, var(--color-body) 100%)',
          }}
        />

        {/* Wordmark */}
        <div className="relative flex items-center gap-3">
          <img src="/logo-192.webp" alt="Gravity Room logo" width={36} height={36} />
          <span className="font-display text-xl tracking-[0.06em] text-main">Gravity Room</span>
        </div>

        {/* Statement headline */}
        <h2 className="relative font-display leading-[0.92] text-main text-[clamp(48px,6vw,72px)] tracking-[0.02em]">
          {t('login.auth_separator')}
        </h2>

        {/* License stamp */}
        <p className="relative font-mono text-[10px] uppercase tracking-[0.22em] text-label">
          {EST_LINE}
        </p>
      </aside>

      {/* Right — auth card */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div
          data-testid="auth-card"
          className="relative w-full max-w-[380px] border border-rule bg-card p-8"
        >
          <CornerTicks colorClass="border-rule-light" size={10} />

          <Kicker noRule className="mb-3">
            {t('login.form.title')}
          </Kicker>
          <h1 className="font-display text-4xl leading-none text-main tracking-[0.04em]">
            Gravity Room
          </h1>

          {/* Google button */}
          <div className="mt-7 flex justify-center border border-rule bg-header py-3">
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (credential) void handleGoogleSuccess(credential);
              }}
              onError={() => {
                setError(t('login.errors.google_auth_error'));
              }}
              theme="filled_black"
              size="large"
              width="260"
            />
          </div>

          {/* Dev-only bypass — stripped from production builds */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => void handleDevLogin()}
              className="mt-3 w-full border border-dashed border-accent-dim py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-deep transition-colors hover:text-accent cursor-pointer"
            >
              {t('login.dev.dev_login')}
            </button>
          )}

          {/* Error */}
          {error && (
            <div
              className="mt-3 flex items-start gap-2 border border-error-line bg-error-bg px-3 py-2 text-xs text-error"
              role="alert"
            >
              <span className="mt-px shrink-0 leading-none">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Guest entry — below the auth card */}
        <button
          type="button"
          onClick={handleGuestEntry}
          className="mt-5 cursor-pointer px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t('login.guest.cta')}
        </button>

        {/* Tagline */}
        <p className="mt-8 font-mono text-[9px] uppercase tracking-[0.4em] text-label">
          {t('login.tagline')}
        </p>
      </main>
    </div>
  );
}
