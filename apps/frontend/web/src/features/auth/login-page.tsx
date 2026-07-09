import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useHead } from '@/hooks/use-head';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { sanitizeAuthError } from '@/lib/auth-errors';
import { fetchAuthProviders, type AuthProviders } from '@/lib/api-functions';
import { trackEvent } from '@/lib/analytics';
import { Kicker } from '@/components/kicker';
import { CornerTicks } from '@/components/corner-ticks';

const EST_LINE = 'EST. 2025 · OPEN SOURCE · AGPL-3.0';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const DEFAULT_AUTH_PROVIDERS: AuthProviders = {
  emailPassword: true,
  google: false,
  apple: false,
  github: false,
  microsoft: false,
};

export function LoginPage(): React.ReactNode {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  const page = <LoginPageInner googleClientId={googleClientId} />;

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{page}</GoogleOAuthProvider>
  ) : (
    page
  );
}

type EmailMode = 'signin' | 'signup';
type FormMessage = { readonly kind: 'error' | 'success'; readonly text: string };
/** Client-side state of the "resend verification" affordance shown after an EMAIL_NOT_VERIFIED sign-in. */
type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

function LoginPageInner({ googleClientId }: { readonly googleClientId: string }): React.ReactNode {
  const { t } = useTranslation();
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerification,
    signInWithDev,
    user,
    loading,
  } = useAuth();
  const { enterGuestMode, isGuest } = useGuest();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Email/password progressive-disclosure form state.
  const [showEmail, setShowEmail] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  // Resend-verification affordance: set to the address whose sign-in failed
  // with EMAIL_NOT_VERIFIED. Captured at failure time so a later edit of the
  // email field cannot silently redirect the resend to a different address.
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [authProviders, setAuthProviders] = useState<AuthProviders>(DEFAULT_AUTH_PROVIDERS);
  const googleEnabled = authProviders.google && googleClientId.length > 0;

  // /login is disallowed in robots.txt and behind auth — keep it out of the
  // index explicitly and give it a self-canonical instead of the landing's.
  useHead({
    title: t('login.page.title'),
    canonical: 'https://gravityroom.app/login',
    robots: 'noindex, follow',
  });

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

  useEffect(() => {
    let active = true;
    void fetchAuthProviders()
      .then((providers) => {
        if (active) setAuthProviders(providers);
      })
      .catch(() => {
        // Keep the conservative defaults if the public provider discovery call fails.
      });
    return () => {
      active = false;
    };
  }, []);

  /** Translates an API error code to a localized message, falling back to generic. */
  const codeMessage = (code: string | undefined): string =>
    t([`login.errors.${code ?? 'generic'}`, 'login.errors.generic']);

  const handleGoogleSuccess = async (credential: string): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle(credential);
    if (authError) {
      setError(t(sanitizeAuthError(authError.message)));
    } else {
      void navigate({ to: '/app' });
    }
  };

  const handleSocialRedirect = (provider: 'apple' | 'github' | 'microsoft'): void => {
    trackEvent('login_social_click');
    window.location.href = `${API_BASE}/api/auth/${provider}/start`;
  };

  const submitSignIn = async (): Promise<void> => {
    const attemptedEmail = email.trim();
    const result = await signInWithEmail(attemptedEmail, password);
    if (result.ok) {
      void navigate({ to: '/app' });
      return;
    }
    // Unverified accounts can't sign in yet - surface the "check your inbox"
    // message plus a resend affordance instead of a dead-end error.
    if (result.code === 'EMAIL_NOT_VERIFIED') setResendEmail(attemptedEmail);
    setFormMessage({ kind: 'error', text: codeMessage(result.code) });
  };

  const submitSignUp = async (): Promise<void> => {
    const result = await signUpWithEmail(email.trim(), password, name.trim() || undefined);
    if (result.ok) {
      setFormMessage({ kind: 'success', text: t('login.signup_success') });
    } else {
      setFormMessage({ kind: 'error', text: codeMessage(result.code) });
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setFormMessage(null);
    setResendEmail(null);
    setResendStatus('idle');
    setSubmitting(true);
    try {
      await (emailMode === 'signin' ? submitSignIn() : submitSignUp());
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    // Basic client-side throttle: block while a send is in flight or already sent.
    if (resendEmail === null || resendStatus === 'sending' || resendStatus === 'sent') return;
    setResendStatus('sending');
    const result = await resendVerification(resendEmail);
    setResendStatus(result.ok ? 'sent' : 'error');
  };

  const handleGuestEntry = (): void => {
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

  // Only render sign-in methods this deployment actually offers (per
  // /auth/providers); we never show disabled "coming soon" placeholders.
  const hasSocialProvider =
    googleEnabled || authProviders.apple || authProviders.github || authProviders.microsoft;

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
          className="relative w-full max-w-[400px] border border-rule bg-card p-8"
        >
          <CornerTicks colorClass="border-rule-light" size={10} />

          <Kicker noRule className="mb-3">
            {t('login.form.title')}
          </Kicker>
          <h1 className="font-display text-4xl leading-none text-main tracking-[0.04em]">
            Gravity Room
          </h1>

          {/* Sign-in providers — only the methods this deployment offers
              (per /auth/providers) are rendered; no disabled placeholders. */}
          {hasSocialProvider && (
            <div className="mt-7 flex flex-col gap-2.5">
              {googleEnabled && (
                <GoogleSignInButton
                  label={t('login.social.google')}
                  onCredential={(credential) => void handleGoogleSuccess(credential)}
                  onError={() => setError(t('login.errors.google_auth_error'))}
                />
              )}
              {authProviders.apple && (
                <SocialButton
                  label={t('login.social.apple')}
                  onClick={() => handleSocialRedirect('apple')}
                />
              )}
              {authProviders.github && (
                <SocialButton
                  label={t('login.social.github')}
                  onClick={() => handleSocialRedirect('github')}
                />
              )}
              {authProviders.microsoft && (
                <SocialButton
                  label={t('login.social.microsoft')}
                  onClick={() => handleSocialRedirect('microsoft')}
                />
              )}
            </div>
          )}

          {/* Divider — only when a social method sits above the email form. */}
          {hasSocialProvider && (
            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-rule" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-label">
                {t('login.divider')}
              </span>
              <span className="h-px flex-1 bg-rule" />
            </div>
          )}

          {/* Email — progressive disclosure */}
          {!showEmail ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="w-full cursor-pointer border border-rule bg-header py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-main transition-colors hover:border-rule-light"
            >
              ▸ {t('login.email.toggle')}
            </button>
          ) : (
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                  {t('login.email.email_label')}
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.email.email_placeholder')}
                  className="border border-rule bg-header px-3 py-2 text-sm text-main outline-none focus:border-accent"
                />
              </label>

              {emailMode === 'signup' && (
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                    {t('login.email.name_label')}
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('login.email.name_placeholder')}
                    className="border border-rule bg-header px-3 py-2 text-sm text-main outline-none focus:border-accent"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                  {t('login.email.password_label')}
                </span>
                <input
                  type="password"
                  required
                  minLength={emailMode === 'signup' ? 8 : undefined}
                  autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.email.password_placeholder')}
                  className="border border-rule bg-header px-3 py-2 text-sm text-main outline-none focus:border-accent"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer border border-accent-dim bg-accent-deep/10 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailMode === 'signin'
                  ? t('login.email.submit_signin')
                  : t('login.email.submit_signup')}
              </button>

              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em]">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                    setFormMessage(null);
                    setResendEmail(null);
                    setResendStatus('idle');
                  }}
                  className="cursor-pointer text-muted transition-colors hover:text-main"
                >
                  {emailMode === 'signin' ? t('login.email.to_signup') : t('login.email.to_signin')}
                </button>
                {emailMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => void navigate({ to: '/reset-password' })}
                    className="cursor-pointer text-muted transition-colors hover:text-main"
                  >
                    {t('login.email.forgot')}
                  </button>
                )}
              </div>

              {formMessage && (
                <div
                  role="alert"
                  className={
                    formMessage.kind === 'error'
                      ? 'border border-error-line bg-error-bg px-3 py-2 text-xs text-error'
                      : 'border border-rule bg-header px-3 py-2 text-xs text-main'
                  }
                >
                  {formMessage.text}
                </div>
              )}

              {/* Resend verification - only after an EMAIL_NOT_VERIFIED sign-in. */}
              {resendEmail !== null && emailMode === 'signin' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                    className="w-full cursor-pointer border border-rule bg-header py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-main transition-colors hover:border-rule-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('login.email.resend')}
                  </button>
                  {resendStatus === 'sent' && (
                    <p role="status" className="font-mono text-[10px] tracking-[0.04em] text-muted">
                      {t('login.email.resend_sent')}
                    </p>
                  )}
                  {resendStatus === 'error' && (
                    <p role="alert" className="font-mono text-[10px] tracking-[0.04em] text-error">
                      {t('login.email.resend_error')}
                    </p>
                  )}
                </div>
              )}
            </form>
          )}

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

          {/* Top-level error (Google / dev) */}
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

/** The official multicolor Google "G", sized to sit inline with mono labels. */
function GoogleGlyph(): React.ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Google sign-in styled to match the rest of the auth card. Google renders its
 * button inside an iframe that cannot be CSS-restyled, so we paint our own
 * brutalist skin and lay the real (transparent) Google button on top to capture
 * the click — keeping the secure ID-token credential flow untouched. The
 * overlay width tracks the container so the whole skin stays clickable.
 */
function GoogleSignInButton({
  label,
  onCredential,
  onError,
}: {
  readonly label: string;
  readonly onCredential: (credential: string) => void;
  readonly onError: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setOverlayWidth(Math.min(400, Math.max(200, Math.round(width))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="group relative">
      {/* Visible skin — identical to the email/social buttons. */}
      <div className="flex w-full items-center justify-center gap-2.5 border border-rule bg-header py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-main transition-colors group-hover:border-rule-light">
        <GoogleGlyph />
        <span>{label}</span>
      </div>
      {/* Real Google button: transparent, layered on top, captures the click. */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-0">
        <GoogleLogin
          onSuccess={({ credential }) => {
            if (credential) onCredential(credential);
          }}
          onError={onError}
          theme="filled_black"
          size="large"
          width={overlayWidth}
          text="continue_with"
        />
      </div>
    </div>
  );
}

function SocialButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 border border-rule bg-header py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-main transition-colors hover:border-rule-light"
    >
      <span>{label}</span>
    </button>
  );
}
