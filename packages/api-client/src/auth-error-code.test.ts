import { describe, expect, it } from 'vitest';
import { authErrorCode } from './auth-error-code';

describe('authErrorCode', () => {
  it('keeps the server code whatever the status', () => {
    expect(authErrorCode(401, 'INVALID_TOKEN')).toBe('INVALID_TOKEN');
    expect(authErrorCode(500, 'EMAIL_NOT_CONFIGURED')).toBe('EMAIL_NOT_CONFIGURED');
  });

  it.each([
    [429, 'RATE_LIMITED'],
    [401, 'INVALID_CREDENTIALS'],
    [403, 'EMAIL_NOT_VERIFIED'],
    [409, 'EMAIL_TAKEN'],
  ])('maps a %i without a code to %s', (status, code) => {
    expect(authErrorCode(status, undefined)).toBe(code);
  });

  it('falls back to generic for any other status', () => {
    expect(authErrorCode(500, undefined)).toBe('generic');
    expect(authErrorCode(400, undefined)).toBe('generic');
  });
});
