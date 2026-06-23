/**
 * Transactional email via Resend (HTTP API — no SDK, no SMTP server).
 *
 * Graceful fallback: when RESEND_API_KEY / EMAIL_FROM are unset the send is a
 * no-op that logs the intent. In non-production it also logs the action link so
 * local auth flows are completable without a Resend account. Mirrors the
 * fail-soft Telegram module — auth flows never block on email delivery.
 */
import { logger } from './logger';
import { getWebBaseUrl } from './app-url';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 10_000;

interface SendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * Sends one transactional email. Returns true when accepted by Resend, false
 * when skipped (unconfigured) or failed. Never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];

  if (!apiKey || !from) {
    logger.warn(
      { to: input.to, subject: input.subject },
      'email: RESEND_API_KEY/EMAIL_FROM unset — skipping send (no-op)'
    );
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, to: input.to }, 'email: Resend returned non-2xx');
      return false;
    }
    return true;
  } catch (err: unknown) {
    logger.warn({ err, to: input.to }, 'email: send failed');
    return false;
  }
}

/** Logs the action link in non-production so local flows work without Resend. */
function devLogLink(kind: string, link: string): void {
  if (process.env['NODE_ENV'] !== 'production') {
    logger.info({ kind, link }, `email[dev]: ${kind} link`);
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${getWebBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  devLogLink('verify-email', link);
  await sendEmail({
    to,
    subject: 'Verify your email — Gravity Room',
    html: `<p>Confirm your email to activate your Gravity Room account.</p><p><a href="${link}">Verify email</a></p><p>If you didn't sign up, you can ignore this message.</p>`,
    text: `Confirm your email to activate your Gravity Room account: ${link}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${getWebBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  devLogLink('reset-password', link);
  await sendEmail({
    to,
    subject: 'Reset your password — Gravity Room',
    html: `<p>Reset your Gravity Room password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request it, you can ignore this message.</p>`,
    text: `Reset your Gravity Room password (expires in 1 hour): ${link}`,
  });
}
