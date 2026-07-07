/**
 * email.ts unit tests — configuration gate, fail-soft send behavior, and
 * action-link construction.
 *
 * The module reads RESEND_API_KEY / EMAIL_FROM at CALL time (inside each
 * function), so no module re-import is needed: vi.stubEnv per test is enough.
 * fetch is stubbed on globalThis with vi.stubGlobal; CORS_ORIGIN is stubbed so
 * getWebBaseUrl() yields a deterministic link origin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isRecord } from '@gzclp/domain/type-guards';
import {
  isEmailConfigured,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from './email';

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
  () => Promise.resolve(new Response('{"id":"email-1"}', { status: 200 }))
);

/** Extracts and validates the JSON body of the nth intercepted fetch call. */
function sentBody(callIndex = 0): Record<string, unknown> {
  const call = mockFetch.mock.calls[callIndex];
  if (!call) throw new Error(`fetch call ${callIndex} was not recorded`);
  const init = call[1];
  if (!init || typeof init.body !== 'string') throw new Error('expected a JSON string body');
  const parsed: unknown = JSON.parse(init.body);
  if (!isRecord(parsed)) throw new Error('expected an object body');
  return parsed;
}

const CONFIGURED_KEY = 're_test_key';
const CONFIGURED_FROM = 'Gravity Room <no-reply@gravityroom.app>';
const WEB_ORIGIN = 'https://app.example.com';

beforeEach(() => {
  mockFetch
    .mockReset()
    .mockImplementation(() => Promise.resolve(new Response('{"id":"email-1"}', { status: 200 })));
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('RESEND_API_KEY', CONFIGURED_KEY);
  vi.stubEnv('EMAIL_FROM', CONFIGURED_FROM);
  vi.stubEnv('CORS_ORIGIN', WEB_ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// isEmailConfigured
// ---------------------------------------------------------------------------

describe('isEmailConfigured', () => {
  it('returns true when both RESEND_API_KEY and EMAIL_FROM are set', () => {
    expect(isEmailConfigured()).toBe(true);
  });

  it('returns false when RESEND_API_KEY is missing', () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns false when EMAIL_FROM is missing', () => {
    vi.stubEnv('EMAIL_FROM', undefined);
    expect(isEmailConfigured()).toBe(false);
  });

  it('returns false when both are missing', () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.stubEnv('EMAIL_FROM', undefined);
    expect(isEmailConfigured()).toBe(false);
  });

  it('treats empty strings as unconfigured', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(isEmailConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

const INPUT = {
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('sendEmail', () => {
  it('returns false without calling fetch when unconfigured', async () => {
    // Arrange
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.stubEnv('EMAIL_FROM', undefined);

    // Act
    const sent = await sendEmail(INPUT);

    // Assert
    expect(sent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts to the Resend endpoint with auth header and payload, returning true on 2xx', async () => {
    // Act
    const sent = await sendEmail(INPUT);

    // Assert
    expect(sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call?.[0]).toBe('https://api.resend.com/emails');
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIGURED_KEY}`,
    });
    expect(sentBody()).toEqual({
      from: CONFIGURED_FROM,
      to: INPUT.to,
      subject: INPUT.subject,
      html: INPUT.html,
      text: INPUT.text,
    });
  });

  it('returns false when Resend responds with a non-2xx status', async () => {
    // Arrange
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response('{"message":"invalid"}', { status: 422 }))
    );

    // Act
    const sent = await sendEmail(INPUT);

    // Assert
    expect(sent).toBe(false);
  });

  it('returns false (never throws) when fetch rejects', async () => {
    // Arrange
    mockFetch.mockImplementation(() => Promise.reject(new Error('ECONNREFUSED')));

    // Act / Assert
    await expect(sendEmail(INPUT)).resolves.toBe(false);
  });

  it('returns false (never throws) when fetch throws synchronously', async () => {
    // Arrange
    mockFetch.mockImplementation((): Promise<Response> => {
      throw new Error('boom');
    });

    // Act / Assert
    await expect(sendEmail(INPUT)).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendVerificationEmail / sendPasswordResetEmail — link construction
// ---------------------------------------------------------------------------

describe('sendVerificationEmail', () => {
  it('builds a verify-email link with the URL-encoded token in html and text', async () => {
    // Arrange — token with characters that must be percent-encoded
    const token = 'a b+c/d=e';
    const expectedLink = `${WEB_ORIGIN}/verify-email?token=a%20b%2Bc%2Fd%3De`;

    // Act
    await sendVerificationEmail('user@example.com', token);

    // Assert
    const body = sentBody();
    expect(body['to']).toBe('user@example.com');
    expect(body['subject']).toBe('Verify your email — Gravity Room');
    expect(body['html']).toContain(`href="${expectedLink}"`);
    expect(body['text']).toContain(expectedLink);
  });

  it('derives the link origin from the request when CORS_ORIGIN is unset', async () => {
    // Arrange — same-origin production mode: origin comes from forwarded headers
    vi.stubEnv('CORS_ORIGIN', undefined);
    const request = new Request('http://internal/api/auth/signup', {
      headers: { 'x-forwarded-host': 'gravityroom.app', 'x-forwarded-proto': 'https' },
    });

    // Act
    await sendVerificationEmail('user@example.com', 'tok123', request);

    // Assert
    const body = sentBody();
    expect(body['text']).toContain('https://gravityroom.app/verify-email?token=tok123');
  });

  it('resolves without sending when email is unconfigured', async () => {
    // Arrange
    vi.stubEnv('RESEND_API_KEY', undefined);

    // Act / Assert — fail-soft: auth flows never block on email
    await expect(sendVerificationEmail('user@example.com', 'tok')).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('sendPasswordResetEmail', () => {
  it('builds a reset-password link with the URL-encoded token in html and text', async () => {
    // Arrange
    const token = 'r&s?t';
    const expectedLink = `${WEB_ORIGIN}/reset-password?token=r%26s%3Ft`;

    // Act
    await sendPasswordResetEmail('user@example.com', token);

    // Assert
    const body = sentBody();
    expect(body['to']).toBe('user@example.com');
    expect(body['subject']).toBe('Reset your password — Gravity Room');
    expect(body['html']).toContain(`href="${expectedLink}"`);
    expect(body['text']).toContain(expectedLink);
  });

  it('resolves without sending when email is unconfigured', async () => {
    // Arrange
    vi.stubEnv('EMAIL_FROM', undefined);

    // Act / Assert
    await expect(sendPasswordResetEmail('user@example.com', 'tok')).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
