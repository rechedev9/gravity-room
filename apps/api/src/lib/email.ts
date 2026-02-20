/**
 * Email service — configure RESEND_API_KEY to send real emails via Resend.
 * In dev, logs via structured logger instead of sending.
 */
import { isRecord } from '@gzclp/shared/type-guards';
import { logger } from './logger';

const RESEND_API_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 5_000;

interface EmailPayload {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

async function sendEmail(payload: EmailPayload, errorContext: string): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];

  if (!apiKey) {
    logger.warn({ email: payload.to }, `[DEV] ${errorContext} — no RESEND_API_KEY configured`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env['EMAIL_FROM'] ?? 'noreply@gzclp.app',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const err: unknown = await res.json().catch(() => ({}));
    const message = isRecord(err) ? JSON.stringify(err) : 'unknown error';
    throw new Error(`${errorContext}: ${message}`);
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail(
    {
      to: email,
      subject: 'Reset your GZCLP Tracker password',
      html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    },
    'Password reset email failed'
  );
}

export async function sendSecurityAlertEmail(email: string): Promise<void> {
  await sendEmail(
    {
      to: email,
      subject: 'Security alert: all sessions revoked',
      html: [
        '<p>We detected unusual activity on your GZCLP Tracker account.</p>',
        '<p>As a precaution, <strong>all active sessions have been terminated</strong>.</p>',
        '<p>If this was you, you can safely sign in again. ',
        'If you did not expect this, please change your password immediately.</p>',
      ].join(''),
    },
    'Security alert email failed'
  );
}
