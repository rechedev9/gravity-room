import { describe, it, expect } from 'vitest';
import { clientIpFromVercelXff, clientIpFromXff, isVercelEnvironment } from './request-logger';

describe('isVercelEnvironment', () => {
  it('trusts only the platform literal VERCEL=1', () => {
    expect(isVercelEnvironment('1')).toBe(true);
    expect(isVercelEnvironment('true')).toBe(false);
    expect(isVercelEnvironment('false')).toBe(false);
    expect(isVercelEnvironment(undefined)).toBe(false);
  });
});

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

  it('rejects arbitrary non-IP bucket identifiers', () => {
    expect(clientIpFromXff('attacker-controlled-bucket')).toBeUndefined();
  });
});

describe('clientIpFromVercelXff', () => {
  it('returns the first valid platform client IP', () => {
    expect(clientIpFromVercelXff('203.0.113.10, 10.0.0.1')).toBe('203.0.113.10');
  });

  it('skips malformed values and supports IPv6', () => {
    expect(clientIpFromVercelXff('not-an-ip, 2001:db8::1')).toBe('2001:db8::1');
  });
});
