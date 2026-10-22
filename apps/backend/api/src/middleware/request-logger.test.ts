import { describe, it, expect } from 'vitest';
import {
  clientIpFromXff,
  deriveClientIp,
  resolveResponseStatus,
  safeRequestPath,
} from './request-logger';

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

describe('deriveClientIp', () => {
  it('with a trusted proxy uses the rightmost x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7' });
    expect(deriveClientIp(headers, true)).toBe('198.51.100.7');
  });

  it('without a trusted proxy reports unknown', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    expect(deriveClientIp(headers, false)).toBe('unknown');
  });
});

describe('safeRequestPath', () => {
  it.each([
    ['https://example.com/api/nope?token=secret', '/api/nope'],
    ['/api/health', '/api/health'],
    ['http://[invalid', '/<invalid-url>'],
  ])('maps %s to %s without throwing', (rawUrl, expected) => {
    expect(safeRequestPath(rawUrl)).toBe(expected);
  });
});

describe('resolveResponseStatus', () => {
  it('uses the native Response status for redirects and body-less responses', () => {
    expect(resolveResponseStatus(Response.redirect('https://example.com'), 200)).toBe(302);
    expect(resolveResponseStatus(new Response(null, { status: 204 }), 200)).toBe(204);
  });

  it('recognizes Fetch Response objects created in a different JavaScript realm', () => {
    const crossRealmResponse = {
      status: 307,
      headers: new Headers({ location: 'https://example.com' }),
      clone() {
        return this;
      },
    };

    expect(resolveResponseStatus(crossRealmResponse, 200)).toBe(307);
  });

  it('uses Elysia set.status for ordinary handler values', () => {
    expect(resolveResponseStatus({ ok: true }, 201)).toBe(201);
    expect(resolveResponseStatus({ ok: true }, undefined)).toBe(200);
  });
});
