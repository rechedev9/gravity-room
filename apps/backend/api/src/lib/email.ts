/**
 * Transactional email via Resend (HTTP API — no SDK, no SMTP server).
 *
 * Graceful fallback: when RESEND_API_KEY / EMAIL_FROM are unset the send is a
 * no-op that logs the intent with a masked recipient. Full action links are
 * logged only through an explicit local-development opt-in. Mirrors the
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

export function isEmailConfigured(): boolean {
  return Boolean(process.env['RESEND_API_KEY'] && process.env['EMAIL_FROM']);
}

/** Mask an address before it enters operational logs. */
export function maskEmailAddress(address: string): string {
  const separator = address.lastIndexOf('@');
  if (separator <= 0 || separator === address.length - 1) return '[masked-email]';
  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);
  const domainDot = domain.lastIndexOf('.');
  const domainName = domainDot > 0 ? domain.slice(0, domainDot) : domain;
  const suffix = domainDot > 0 ? domain.slice(domainDot) : '';
  return `${local.charAt(0)}***@${domainName.charAt(0)}***${suffix}`;
}

/** Full bearer action links may only be logged by an explicit local opt-in. */
export function shouldLogAuthActionLinks(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env['LOG_AUTH_ACTION_LINKS'] === 'true' &&
    env['NODE_ENV'] === 'development' &&
    env['VERCEL'] !== '1'
  );
}

/**
 * Sends one transactional email. Returns true when accepted by Resend, false
 * when skipped (unconfigured) or failed. Never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];

  if (!isEmailConfigured()) {
    logger.warn(
      { recipient: maskEmailAddress(input.to), subject: input.subject },
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
      logger.warn(
        { status: res.status, recipient: maskEmailAddress(input.to) },
        'email: Resend returned non-2xx'
      );
      return false;
    }
    return true;
  } catch (err: unknown) {
    logger.warn({ err, recipient: maskEmailAddress(input.to) }, 'email: send failed');
    return false;
  }
}

/** Log a bearer action link only when a developer explicitly opted in locally. */
function devLogLink(kind: string, link: string): void {
  if (shouldLogAuthActionLinks()) {
    logger.info({ kind, link }, `email[local]: ${kind} link`);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  request?: Request
): Promise<void> {
  const link = `${getWebBaseUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
  devLogLink('verify-email', link);
  await sendEmail({
    to,
    subject: 'Verify your email — Gravity Room',
    html: `<p>Confirm your email to activate your Gravity Room account.</p><p><a href="${link}">Verify email</a></p><p>If you didn't sign up, you can ignore this message.</p>`,
    text: `Confirm your email to activate your Gravity Room account: ${link}`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  request?: Request
): Promise<void> {
  const link = `${getWebBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
  devLogLink('reset-password', link);
  await sendEmail({
    to,
    subject: 'Reset your password — Gravity Room',
    html: `<p>Reset your Gravity Room password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request it, you can ignore this message.</p>`,
    text: `Reset your Gravity Room password (expires in 1 hour): ${link}`,
  });
}
