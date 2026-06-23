/**
 * Auth sub-flow pages reached by links/redirects:
 *  - /auth/callback     — landing after an Apple/GitHub redirect (session is in
 *                         the refresh cookie; AuthProvider restores it).
 *  - /verify-email      — consumes the email-verification token, then auto-logs-in.
 *  - /reset-password    — request a reset link, or set a new password with ?token.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useHead } from '@/hooks/use-head';
import { useAuth } from '@/contexts/auth-context';
import { Kicker } from '@/components/kicker';
import { CornerTicks } from '@/components/corner-ticks';

function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function AuthShell({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="grain-overlay flex min-h-dvh flex-col items-center justify-center bg-body px-6 py-12">
      <div className="relative w-full max-w-[400px] border border-rule bg-card p-8">
        <CornerTicks colorClass="border-rule-light" size={10} />
        <Kicker noRule className="mb-4">
          {title}
        </Kicker>
        {children}
      </div>
      <button
        type="button"
        onClick={() => void navigate({ to: '/login' })}
        className="mt-5 cursor-pointer px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-main"
      >
        {t('login.callback.back_to_login')}
      </button>
    </div>
  );
}

const inputClass =
  'border border-rule bg-header px-3 py-2 text-sm text-main outline-none focus:border-accent';
const submitClass =
  'w-full cursor-pointer border border-accent-dim bg-accent-deep/10 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent-deep/20 disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// /auth/callback — social redirect landing
// ---------------------------------------------------------------------------

export function AuthCallbackPage(): React.ReactNode {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const errorCode = queryParam('error');

  useHead({ title: t('login.page.title'), robots: 'noindex, nofollow' });

  useEffect(() => {
    if (errorCode) return;
    if (!loading) {
      void navigate({ to: user ? '/app' : '/login', replace: true });
    }
  }, [errorCode, loading, user, navigate]);

  if (errorCode) {
    return (
      <AuthShell title={t('login.callback.error_title')}>
        <p className="text-sm text-error">
          {t([`login.callback.${errorCode}`, 'login.callback.generic'])}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('login.form.title')}>
      <p className="text-sm text-muted">{t('login.callback.verifying')}</p>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// /verify-email — consume token, auto-login
// ---------------------------------------------------------------------------

export function VerifyEmailPage(): React.ReactNode {
  const { t } = useTranslation();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const ran = useRef(false);

  useHead({ title: t('login.verify_email.title'), robots: 'noindex, nofollow' });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = queryParam('token');
    if (!token) {
      setStatus('error');
      return;
    }
    void verifyEmail(token).then((result) => {
      if (result.ok) {
        setStatus('success');
        window.setTimeout(() => void navigate({ to: '/app', replace: true }), 1200);
      } else {
        setStatus('error');
      }
    });
  }, [verifyEmail, navigate]);

  return (
    <AuthShell title={t('login.verify_email.title')}>
      {status === 'verifying' && (
        <p className="text-sm text-muted">{t('login.verify_email.verifying')}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-main">{t('login.verify_email.success')}</p>
      )}
      {status === 'error' && <p className="text-sm text-error">{t('login.verify_email.error')}</p>}
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// /reset-password — request a link, or set a new password with ?token
// ---------------------------------------------------------------------------

export function ResetPasswordPage(): React.ReactNode {
  const token = queryParam('token');
  return token ? <ResetForm token={token} /> : <RequestForm />;
}

function RequestForm(): React.ReactNode {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useHead({ title: t('login.reset_password.title'), robots: 'noindex, nofollow' });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t('login.reset_password.title')}>
      {sent ? (
        <p className="text-sm text-main">{t('login.reset_password.request_sent')}</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('login.reset_password.request_intro')}</p>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login.email.email_placeholder')}
            className={inputClass}
          />
          <button type="submit" disabled={submitting} className={submitClass}>
            {t('login.reset_password.request_submit')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function ResetForm({ token }: { readonly token: string }): React.ReactNode {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useHead({ title: t('login.reset_password.title'), robots: 'noindex, nofollow' });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await resetPassword(token, password);
      if (result.ok) {
        setStatus('success');
        window.setTimeout(() => void navigate({ to: '/login', replace: true }), 1500);
      } else {
        setStatus('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t('login.reset_password.title')}>
      {status === 'success' ? (
        <p className="text-sm text-main">{t('login.reset_password.success')}</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-label">
              {t('login.reset_password.new_password_label')}
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.reset_password.new_password_placeholder')}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={submitting} className={submitClass}>
            {t('login.reset_password.submit')}
          </button>
          {status === 'error' && (
            <p className="text-sm text-error">{t('login.reset_password.error')}</p>
          )}
        </form>
      )}
    </AuthShell>
  );
}
