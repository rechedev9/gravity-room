import { describe, it, expect } from 'vitest';
import { clientIpFromXff } from './request-logger';

describe('clientIpFromXff', () => {
  it('returns the rightmost entry (the address the trusted proxy observed)', () => {
    // Caddy appends the real peer IP, so the last entry is trustworthy.
    expect(clientIpFromXff('203.0.113.9')).toBe('203.0.113.9');
    expect(clientIpFromXff('10.0.0.1, 203.0.113.9')).toBe('203.0.113.9');
  });

  it('ignores a client-spoofed leftmost value', () => {
    // Attacker sends `X-Forwarded-For: 1.2.3.4`; proxy appends the real IP.
    // Reading the leftmost would let the attacker rotate the rate-limit key.
    expect(clientIpFromXff('1.2.3.4, 198.51.100.7')).toBe('198.51.100.7');
  });

  it('trims whitespace and skips trailing empty segments', () => {
    expect(clientIpFromXff('203.0.113.9 ,  ')).toBe('203.0.113.9');
  });

  it('returns undefined when no usable entry is present', () => {
    expect(clientIpFromXff('')).toBeUndefined();
    expect(clientIpFromXff('  ,  ')).toBeUndefined();
  });
});
