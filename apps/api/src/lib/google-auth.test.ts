/**
 * google-auth tests — verify ApiError is thrown with the correct code/status
 * for JWKS fetch failures and expired tokens.
 *
 * Strategy for 4.10: mock global fetch to return a non-OK response, then call
 * verifyGoogleToken and assert the thrown ApiError.
 *
 * Strategy for 4.11: the JWKS cache is module-level state. We need a real-looking
 * RS256 key pair. Bun's Web Crypto supports generateKey for RSASSA-PKCS1-v1_5.
 * We generate a key pair, export the public key as JWK, mock fetch to return
 * a valid JWKS, sign a JWT with exp in the past, and assert AUTH_INVALID.
 *
 * IMPORTANT: jwksCache is a module-level variable. Each test must clear it by
 * making fetch return a fresh response (since tests run in the same process and
 * the cache TTL is 1 hour).
 */
process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ApiError } from '../middleware/error-handler';

// We import verifyGoogleToken after setting up env vars.
import { verifyGoogleToken } from './google-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal JWKS response body from a CryptoKeyPair public key. */
async function buildJwksResponse(kid: string, publicKey: CryptoKey): Promise<{ keys: unknown[] }> {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return {
    keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }],
  };
}

/** Sign a JWT with the given private key and payload. */
async function signJwt(
  kid: string,
  privateKey: CryptoKey,
  payload: Record<string, unknown>
): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = Buffer.from(sig).toString('base64url');
  return `${signingInput}.${signature}`;
}

/** Generate a fresh RS256 key pair. */
async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ['sign', 'verify']
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyGoogleToken — JWKS fetch failure', () => {
  beforeEach(() => {
    // Reset the module-level jwksCache between tests by forcing a new fetch.
    // We do this by making fetch return a non-OK response initially so the
    // cache is never populated, OR by ensuring we use a fresh mock each test.
  });

  it('4.10: throws ApiError with code AUTH_JWKS_UNAVAILABLE when fetch returns non-OK', async () => {
    // Arrange: mock fetch to return 503 non-OK response
    // We pass a minimal 3-segment token so the function gets past format checks
    // and reaches the fetchGoogleCerts() call.
    const mockFetch = mock(
      (): Promise<Response> => Promise.resolve(new Response(null, { status: 503 }))
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const fakeToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3QifQ.eyJzdWIiOiJ1c2VyMSJ9.c2ln';

    // Act
    let thrown: unknown;
    try {
      await verifyGoogleToken(fakeToken);
    } catch (e) {
      thrown = e;
    }

    // Assert
    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_JWKS_UNAVAILABLE');
    expect((thrown as ApiError).statusCode).toBe(503);
  });
});

describe('verifyGoogleToken — expired token', () => {
  it('4.11: throws ApiError with code AUTH_INVALID and status 401 for expired token', async () => {
    // Arrange: generate RSA key pair and build a JWKS
    const keyPair = await generateRsaKeyPair();
    const kid = 'test-key-1';
    const jwksBody = await buildJwksResponse(kid, keyPair.publicKey);

    // Mock fetch to return a valid JWKS
    const mockFetch = mock(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify(jwksBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    // Build an expired JWT payload
    const expiredPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      aud: 'test-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    };

    const token = await signJwt(kid, keyPair.privateKey, expiredPayload);

    // Act
    let thrown: unknown;
    try {
      await verifyGoogleToken(token);
    } catch (e) {
      thrown = e;
    }

    // Assert
    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_INVALID');
    expect((thrown as ApiError).statusCode).toBe(401);
  });
});
