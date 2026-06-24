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
  google: true,
  apple: false,
  github: false,
  microsoft: false,
};

export function LoginPage(): React.ReactNode {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <LoginPageInner />
    </GoogleOAuthProvider>
  );
}

type EmailMode = 'signin' | 'signup';
type FormMessage = { readonly kind: 'error' | 'success'; readonly text: string };

function LoginPageInner(): React.ReactNode {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInWithDev, user, loading } =
    useAuth();
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
  const [authProviders, setAuthProviders] = useState<AuthProviders>(DEFAULT_AUTH_PROVIDERS);

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

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setFormMessage(null);
    setSubmitting(true);
    try {
      if (emailMode === 'signin') {
        const result = await signInWithEmail(email.trim(), password);
        if (result.ok) {
          void navigate({ to: '/app' });
        } else {
          setFormMessage({ kind: 'error', text: codeMessage(result.code) });
        }
      } else {
        const result = await signUpWithEmail(email.trim(), password, name.trim() || undefined);
        if (result.ok) {
          setFormMessage({ kind: 'success', text: t('login.signup_success') });
        } else {
          setFormMessage({ kind: 'error', text: codeMessage(result.code) });
        }
      }
    } finally {
      setSubmitting(false);
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
          className="relative w-full max-w-[400px] border border-rule bg-card p-8"
        >
          <CornerTicks colorClass="border-rule-light" size={10} />

          <Kicker noRule className="mb-3">
            {t('login.form.title')}
          </Kicker>
          <h1 className="font-display text-4xl leading-none text-main tracking-[0.04em]">
            Gravity Room
          </h1>

          {/* Social providers — deployment availability comes from /auth/providers. */}
          <div className="mt-7 flex flex-col gap-2.5">
            {authProviders.google ? (
              <div className="flex justify-center border border-rule bg-header py-3">
                <GoogleLogin
                  onSuccess={({ credential }) => {
                    if (credential) void handleGoogleSuccess(credential);
                  }}
                  onError={() => {
                    setError(t('login.errors.google_auth_error'));
                  }}
                  theme="filled_black"
                  size="large"
                  width="320"
                />
              </div>
            ) : (
              <SocialButton
                label={t('login.social.google')}
                enabled={false}
                comingSoonLabel={t('login.social.coming_soon')}
                onClick={() => undefined}
              />
            )}

            <SocialButton
              label={t('login.social.apple')}
              enabled={authProviders.apple}
              comingSoonLabel={t('login.social.coming_soon')}
              onClick={() => handleSocialRedirect('apple')}
            />
            <SocialButton
              label={t('login.social.github')}
              enabled={authProviders.github}
              comingSoonLabel={t('login.social.coming_soon')}
              onClick={() => handleSocialRedirect('github')}
            />
            <SocialButton
              label={t('login.social.microsoft')}
              enabled={authProviders.microsoft}
              comingSoonLabel={t('login.social.coming_soon')}
              onClick={() => handleSocialRedirect('microsoft')}
            />
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-rule" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-label">
              {t('login.divider')}
            </span>
            <span className="h-px flex-1 bg-rule" />
          </div>

          {/* Email — progressive disclosure */}
          {!showEmail ? (
            <button
              type="button"
              disabled={!authProviders.emailPassword}
              onClick={() => setShowEmail(true)}
              className="w-full cursor-pointer border border-rule bg-header py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-main transition-colors hover:border-rule-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▸ {t('login.email.toggle')}
              {!authProviders.emailPassword && (
                <span className="ml-2 font-mono text-[9px] tracking-[0.1em] text-label">
                  [{t('login.social.coming_soon')}]
                </span>
              )}
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

function SocialButton({
  label,
  enabled,
  comingSoonLabel,
  onClick,
}: {
  readonly label: string;
  readonly enabled: boolean;
  readonly comingSoonLabel: string;
  readonly onClick: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className="flex w-full items-center justify-center gap-2 border border-rule bg-header py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-main transition-colors hover:border-rule-light disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{label}</span>
      {!enabled && (
        <span className="font-mono text-[9px] tracking-[0.1em] text-label">
          [{comingSoonLabel}]
        </span>
      )}
    </button>
  );
}
