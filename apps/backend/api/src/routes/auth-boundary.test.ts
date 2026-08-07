import { describe, expect, it } from 'vitest';
import { ApiError } from '../middleware/error-handler';
import {
  assertTrustedCredentialRequest,
  assertValidAvatarDataUrl,
  classifyDevice,
  MAX_AVATAR_DATA_URL_CHARS,
  normalizeDisplayName,
} from './auth-boundary';

function expectApiError(run: () => void, status: number, code: string): void {
  try {
    run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error.statusCode).toBe(status);
      expect(error.code).toBe(code);
    }
    return;
  }
  throw new Error(`Expected ApiError ${code}`);
}

describe('classifyDevice', () => {
  const cases = [
    { userAgent: undefined, expected: 'Unknown' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile)', expected: 'Mobile' },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', expected: 'Desktop' },
    { userAgent: 'ExampleCrawler/1.0', expected: 'Bot' },
  ] as const;

  it.each(cases)('classifies $expected user agents', ({ userAgent, expected }) => {
    expect(classifyDevice(userAgent)).toBe(expected);
  });
});

describe('normalizeDisplayName', () => {
  const validCases = [
    { input: undefined, expected: undefined },
    { input: 'Ada', expected: 'Ada' },
    { input: '  Ada Lovelace  ', expected: 'Ada Lovelace' },
  ] as const;

  it.each(validCases)('normalizes $input', ({ input, expected }) => {
    expect(normalizeDisplayName(input)).toBe(expected);
  });

  it.each(['', ' ', '\t\n'])('rejects a blank name %#', (input) => {
    expectApiError(() => normalizeDisplayName(input), 400, 'INVALID_NAME');
  });
});

describe('assertTrustedCredentialRequest', () => {
  const acceptedCases = [
    { name: 'native JSON request', headers: { 'Content-Type': 'application/json' } },
    {
      name: 'same-origin browser request',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Origin: 'https://api.example.test',
        'Sec-Fetch-Site': 'same-origin',
      },
    },
  ] as const;

  it.each(acceptedCases)('accepts $name', ({ headers }) => {
    const request = new Request('https://api.example.test/api/auth/login', { headers });
    expect(() => assertTrustedCredentialRequest(request)).not.toThrow();
  });

  const rejectedCases = [
    {
      name: 'missing JSON content type',
      headers: {},
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
    {
      name: 'cross-site fetch metadata',
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
      status: 403,
      code: 'CSRF_REJECTED',
    },
    {
      name: 'untrusted origin',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
      status: 403,
      code: 'CSRF_REJECTED',
    },
    {
      name: 'malformed origin',
      headers: { 'Content-Type': 'application/json', Origin: 'not a URL' },
      status: 403,
      code: 'CSRF_REJECTED',
    },
  ] as const;

  it.each(rejectedCases)('rejects $name', ({ headers, status, code }) => {
    const request = new Request('https://api.example.test/api/auth/login', { headers });
    expectApiError(() => assertTrustedCredentialRequest(request), status, code);
  });
});

describe('assertValidAvatarDataUrl', () => {
  const validCases = [
    undefined,
    null,
    `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString('base64')}`,
    `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`,
    `data:image/webp;base64,${Buffer.from('RIFF0000WEBP', 'ascii').toString('base64')}`,
  ] as const;

  it.each(validCases)('accepts valid avatar input %#', (avatarUrl) => {
    expect(() => assertValidAvatarDataUrl(avatarUrl)).not.toThrow();
  });

  const invalidCases = [
    {
      name: 'unsupported media type',
      avatarUrl: 'data:image/gif;base64,R0lGODlh',
      code: 'INVALID_AVATAR',
    },
    {
      name: 'declared type mismatch',
      avatarUrl: `data:image/png;base64,${Buffer.from('not a png').toString('base64')}`,
      code: 'INVALID_AVATAR',
    },
    {
      name: 'oversized data URL',
      avatarUrl: `data:image/png;base64,${'A'.repeat(MAX_AVATAR_DATA_URL_CHARS)}`,
      code: 'AVATAR_TOO_LARGE',
    },
  ] as const;

  it.each(invalidCases)('rejects $name', ({ avatarUrl, code }) => {
    expectApiError(() => assertValidAvatarDataUrl(avatarUrl), 400, code);
  });
});
