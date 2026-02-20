import { describe, it, expect } from 'bun:test';
import { sanitizeAuthError } from './auth-errors';

// ---------------------------------------------------------------------------
// sanitizeAuthError — public API mapping, integration-style
// Tests the full mapping contract: if the API returns X, the user sees Y.
// ---------------------------------------------------------------------------
describe('sanitizeAuthError', () => {
  it('should map all known error messages to user-friendly strings', () => {
    // This is a snapshot of the entire error mapping contract.
    // If a mapping changes, this test MUST break — that's CI.
    const mappings: Array<[string, string]> = [
      ['Invalid Google credential', 'Google sign-in failed. Please try again.'],
      ['No refresh token', 'Your session has expired. Please sign in again.'],
      ['Invalid refresh token', 'Your session has expired. Please sign in again.'],
      ['Refresh token expired', 'Your session has expired. Please sign in again.'],
    ];

    for (const [raw, expected] of mappings) {
      expect(sanitizeAuthError(raw)).toBe(expected);
    }
  });

  it('should match partial messages containing known error strings', () => {
    const result = sanitizeAuthError('Error: Invalid Google credential from provider');
    expect(result).toBe('Google sign-in failed. Please try again.');
  });

  it('should return generic message for unknown errors', () => {
    const result = sanitizeAuthError('Database connection timeout');
    expect(result).toBe('Something went wrong. Please try again.');
  });

  it('should return generic message for empty string', () => {
    expect(sanitizeAuthError('')).toBe('Something went wrong. Please try again.');
  });
});
