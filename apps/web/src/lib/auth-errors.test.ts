import { describe, it, expect } from 'bun:test';
import { sanitizeAuthError } from './auth-errors';

// ---------------------------------------------------------------------------
// sanitizeAuthError — maps raw API error strings to i18n keys. The test locks
// in the mapping contract; changing a key requires updating the test.
// ---------------------------------------------------------------------------
describe('sanitizeAuthError', () => {
  it('should map all known error messages to translation keys', () => {
    const mappings: Array<[string, string]> = [
      ['Invalid Google credential', 'auth.errors.google_failed'],
      ['No refresh token', 'auth.errors.session_expired'],
      ['Invalid refresh token', 'auth.errors.session_expired'],
      ['Refresh token expired', 'auth.errors.session_expired'],
    ];

    for (const [raw, expected] of mappings) {
      expect(sanitizeAuthError(raw)).toBe(expected);
    }
  });

  it('should match partial messages containing known error strings', () => {
    const result = sanitizeAuthError('Error: Invalid Google credential from provider');
    expect(result).toBe('auth.errors.google_failed');
  });

  it('should return generic key for unknown errors', () => {
    const result = sanitizeAuthError('Database connection timeout');
    expect(result).toBe('auth.errors.generic');
  });

  it('should return generic key for empty string', () => {
    expect(sanitizeAuthError('')).toBe('auth.errors.generic');
  });
});
