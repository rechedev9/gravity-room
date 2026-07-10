import { describe, expect, it } from 'vitest';
import { redactSensitiveText, sanitizedError } from './redact-sensitive';

describe('redactSensitiveText', () => {
  it('redacts credentials embedded in connection URLs', () => {
    const value = redactSensitiveText('connect postgres://admin:super-secret@db.internal/app');
    expect(value).toBe('connect postgres://[Redacted]:[Redacted]@db.internal/app');
    expect(value).not.toContain('super-secret');
  });

  it('redacts bearer tokens, JWTs, and sensitive query parameters', () => {
    const value = redactSensitiveText(
      'Bearer abc.def token=https://app.test/reset?token=raw-secret&password=hunter2 eyJabc.def.ghi'
    );
    expect(value).not.toContain('raw-secret');
    expect(value).not.toContain('hunter2');
    expect(value).not.toContain('eyJabc.def.ghi');
    expect(value).toContain('Bearer [Redacted]');
  });

  it('redacts a Telegram bot token embedded in an API URL path', () => {
    const value = redactSensitiveText(
      'telegram: sendMessage failed POST https://api.telegram.org/bot123456789:AA-Hn_secretTokenXyz/sendMessage timed out'
    );
    expect(value).not.toContain('AA-Hn_secretTokenXyz');
    expect(value).not.toContain('123456789:AA-Hn_secretTokenXyz');
    expect(value).toContain('/bot[Redacted]/sendMessage');
  });

  it('does not mistake a non-token path segment for a Telegram bot token', () => {
    expect(redactSensitiveText('GET /robot-status/health')).toBe('GET /robot-status/health');
  });

  it('preserves ordinary diagnostic text', () => {
    expect(redactSensitiveText('Invalid audience')).toBe('Invalid audience');
  });
});

describe('sanitizedError', () => {
  it('retains the error type and stack without embedded credentials', () => {
    const sanitized = sanitizedError(new TypeError('failed postgres://u:p@db/app'));
    expect(sanitized).toBeInstanceOf(Error);
    if (!(sanitized instanceof Error)) throw new Error('Expected an Error');
    expect(sanitized.name).toBe('TypeError');
    expect(sanitized.message).not.toContain('u:p');
    expect(sanitized.stack).not.toContain('u:p');
  });
});
