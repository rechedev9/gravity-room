process.env['LOG_LEVEL'] = 'silent';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInfo, mockWarn } = vi.hoisted(() => ({
  mockInfo: vi.fn(() => undefined),
  mockWarn: vi.fn(() => undefined),
}));

vi.mock('./logger', () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: vi.fn(() => undefined),
    debug: vi.fn(() => undefined),
  },
}));
vi.mock('./app-url', () => ({
  getWebBaseUrl: () => 'http://localhost:5173',
}));

import {
  maskEmailAddress,
  sendPasswordResetEmail,
  sendVerificationEmail,
  shouldLogAuthActionLinks,
} from './email';

const ORIGINAL_NODE_ENV = process.env['NODE_ENV'];
const ORIGINAL_VERCEL = process.env['VERCEL'];
const ORIGINAL_LOG_LINKS = process.env['LOG_AUTH_ACTION_LINKS'];
const ORIGINAL_RESEND_KEY = process.env['RESEND_API_KEY'];
const ORIGINAL_EMAIL_FROM = process.env['EMAIL_FROM'];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  mockInfo.mockClear();
  mockWarn.mockClear();
  delete process.env['RESEND_API_KEY'];
  delete process.env['EMAIL_FROM'];
  delete process.env['LOG_AUTH_ACTION_LINKS'];
  delete process.env['VERCEL'];
  process.env['NODE_ENV'] = 'test';
});

afterEach(() => {
  restore('NODE_ENV', ORIGINAL_NODE_ENV);
  restore('VERCEL', ORIGINAL_VERCEL);
  restore('LOG_AUTH_ACTION_LINKS', ORIGINAL_LOG_LINKS);
  restore('RESEND_API_KEY', ORIGINAL_RESEND_KEY);
  restore('EMAIL_FROM', ORIGINAL_EMAIL_FROM);
});

describe('email log privacy', () => {
  it.each([
    ['alice@example.com', 'a***@e***.com'],
    ['x@localhost', 'x***@l***'],
    ['invalid-address', '[masked-email]'],
  ])('masks %s as %s', (address, expected) => {
    expect(maskEmailAddress(address)).toBe(expected);
  });

  it('never writes a raw recipient to the unconfigured warning', async () => {
    await sendVerificationEmail('alice.private@example.com', 'secret-token');

    const serialized = JSON.stringify(mockWarn.mock.calls);
    expect(serialized).not.toContain('alice.private@example.com');
    expect(serialized).toContain('a***@e***.com');
  });
});

describe('local action-link logging gate', () => {
  it.each([
    [{ NODE_ENV: 'development', LOG_AUTH_ACTION_LINKS: 'true' }, true],
    [{ NODE_ENV: 'development', LOG_AUTH_ACTION_LINKS: 'false' }, false],
    [{ NODE_ENV: 'test', LOG_AUTH_ACTION_LINKS: 'true' }, false],
    [{ NODE_ENV: 'production', LOG_AUTH_ACTION_LINKS: 'true' }, false],
    [{ NODE_ENV: 'development', LOG_AUTH_ACTION_LINKS: 'true', VERCEL: '1' }, false],
  ])('evaluates explicit environment gate %#', (env, expected) => {
    expect(shouldLogAuthActionLinks(env)).toBe(expected);
  });

  it('does not log a token by default', async () => {
    await sendPasswordResetEmail('alice@example.com', 'RESET_SENTINEL');

    expect(JSON.stringify(mockInfo.mock.calls)).not.toContain('RESET_SENTINEL');
  });

  it('logs a token only with explicit local-development opt-in', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['LOG_AUTH_ACTION_LINKS'] = 'true';

    await sendPasswordResetEmail('alice@example.com', 'RESET_SENTINEL');

    expect(JSON.stringify(mockInfo.mock.calls)).toContain('RESET_SENTINEL');
  });
});
