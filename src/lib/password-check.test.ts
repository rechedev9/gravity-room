import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { checkLeakedPassword } from './password-check';

// ---------------------------------------------------------------------------
// checkLeakedPassword — mock fetch at the I/O boundary
//
// We mock fetch (external network call) but use real crypto.subtle for hashing.
// This tests the actual SHA-1 prefix/suffix logic against a controlled response.
// ---------------------------------------------------------------------------
describe('checkLeakedPassword', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  it('should return true when password hash suffix appears in HIBP response', async () => {
    // "password" SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          '1D2DA4053E34E76F6576ED1DA63134B5E2A:2\r\n' +
            '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\n' +
            '1E4649B934CA495991B7852B855:5\r\n',
          { status: 200 }
        )
      )
    ) as unknown as typeof fetch;

    const result = await checkLeakedPassword('password');
    expect(result).toBe(true);
  });

  it('should return false when password hash suffix is not in HIBP response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          '0000000000000000000000000000000000000:1\r\n' +
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2\r\n',
          { status: 200 }
        )
      )
    ) as unknown as typeof fetch;

    const result = await checkLeakedPassword('my-very-unique-password-12345');
    expect(result).toBe(false);
  });

  it('should return false on network error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network timeout'))
    ) as unknown as typeof fetch;

    const result = await checkLeakedPassword('test');
    expect(result).toBe(false);
  });

  it('should return false on non-200 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('', { status: 503 }))
    ) as unknown as typeof fetch;

    const result = await checkLeakedPassword('test');
    expect(result).toBe(false);
  });
});
