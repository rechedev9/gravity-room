import { describe, it, expect } from 'vitest';
import {
  clientIpFromVercelXff,
  clientIpFromXff,
  deriveClientIp,
  isVercelEnvironment,
} from './request-logger';

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

describe('deriveClientIp', () => {
  it('on Vercel, a spoofed x-forwarded-for does NOT influence the derived IP', () => {
    // Regression: the client controls x-forwarded-for and prepends a spoofed
    // leftmost IP to mint a fresh rate-limit bucket per request. Vercel sets and
    // overwrites x-vercel-forwarded-for with the real client, and that must win.
    const headers = new Headers({
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      'x-vercel-forwarded-for': '203.0.113.10',
    });
    expect(deriveClientIp(headers, { onVercel: true, trustedProxy: true })).toBe('203.0.113.10');
  });

  it('on Vercel, ignores x-forwarded-for entirely even when the platform header is absent', () => {
    // Must NOT fall back to the spoofable x-forwarded-for header; fail closed to
    // 'unknown' so an attacker cannot steer the rate-limit key by its absence.
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    expect(deriveClientIp(headers, { onVercel: true, trustedProxy: true })).toBe('unknown');
  });

  it('off-Vercel with a trusted proxy uses the rightmost x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7' });
    expect(deriveClientIp(headers, { onVercel: false, trustedProxy: true })).toBe('198.51.100.7');
  });

  it('off-Vercel without a trusted proxy reports unknown', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    expect(deriveClientIp(headers, { onVercel: false, trustedProxy: false })).toBe('unknown');
  });
});
