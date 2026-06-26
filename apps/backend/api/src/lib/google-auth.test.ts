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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError } from '../middleware/error-handler';

// We import verifyGoogleToken after setting up env vars.
import { getMobileGoogleClientIds, verifyGoogleToken } from './google-auth';

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

const SHARED_KID = 'test-key-1';
const sharedKeyPairPromise = generateRsaKeyPair();

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
    const mockFetch = vi.fn(
      (): Promise<Response> => Promise.resolve(new Response(null, { status: 503 }))
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const fakeToken = [
      'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3QifQ',
      'eyJzdWIiOiJ1c2VyMSJ9',
      'c2ln',
    ].join('.');

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

describe('verifyGoogleToken — malformed JWT JSON', () => {
  it('throws AUTH_INVALID instead of an unhandled parser error', async () => {
    const malformedHeader = Buffer.from('not json').toString('base64url');
    const validPayload = Buffer.from(
      JSON.stringify({
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        aud: 'test-client-id',
        iss: 'accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');

    let thrown: unknown;
    try {
      await verifyGoogleToken(`${malformedHeader}.${validPayload}.signature`);
    } catch (e) {
      thrown = e;
    }

    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_INVALID');
    expect((thrown as ApiError).statusCode).toBe(401);
  });
});

describe('verifyGoogleToken — expired token', () => {
  it('4.11: throws ApiError with code AUTH_INVALID and status 401 for expired token', async () => {
    // Arrange: generate RSA key pair and build a JWKS
    const keyPair = await sharedKeyPairPromise;
    const jwksBody = await buildJwksResponse(SHARED_KID, keyPair.publicKey);

    // Mock fetch to return a valid JWKS
    const mockFetch = vi.fn(
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

    const token = await signJwt(SHARED_KID, keyPair.privateKey, expiredPayload);

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

describe('verifyGoogleToken — multiple audiences', () => {
  it('accepts an audience listed in GOOGLE_CLIENT_IDS', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
    process.env['GOOGLE_CLIENT_IDS'] = 'web-client-id,mobile-client-id';

    const keyPair = await sharedKeyPairPromise;
    const jwksBody = await buildJwksResponse(SHARED_KID, keyPair.publicKey);

    const mockFetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify(jwksBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const token = await signJwt(SHARED_KID, keyPair.privateKey, {
      sub: 'user-123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      aud: 'mobile-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(verifyGoogleToken(token)).resolves.toEqual({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });
  });

  it('accepts GOOGLE_CLIENT_ID alongside GOOGLE_CLIENT_IDS during staged rollout', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
    process.env['GOOGLE_CLIENT_IDS'] = 'mobile-client-id';

    const keyPair = await sharedKeyPairPromise;
    const jwksBody = await buildJwksResponse(SHARED_KID, keyPair.publicKey);

    const mockFetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify(jwksBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const token = await signJwt(SHARED_KID, keyPair.privateKey, {
      sub: 'user-456',
      email: 'web@example.com',
      email_verified: true,
      name: 'Web User',
      aud: 'web-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(verifyGoogleToken(token)).resolves.toEqual({
      sub: 'user-456',
      email: 'web@example.com',
      name: 'Web User',
    });
  });
});

describe('verifyGoogleToken — JWKS key rotation', () => {
  it('forces a single JWKS refetch when the token kid is absent from the stale cache', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    delete process.env['GOOGLE_CLIENT_IDS'];

    const oldKeyPair = await generateRsaKeyPair();
    const newKeyPair = await generateRsaKeyPair();
    const OLD_KID = 'rotation-old-key';
    const NEW_KID = 'rotation-new-key';

    const oldJwks = await buildJwksResponse(OLD_KID, oldKeyPair.publicKey);
    const newJwks = await buildJwksResponse(NEW_KID, newKeyPair.publicKey);

    // The mock serves the OLD key set until Google "rotates" to the NEW set.
    let currentJwks = oldJwks;
    const mockFetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify(currentJwks), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    // Phase 1: a token signed with OLD_KID populates the cache with the OLD set.
    const oldToken = await signJwt(OLD_KID, oldKeyPair.privateKey, {
      sub: 'user-old',
      email: 'old@example.com',
      email_verified: true,
      name: 'Old User',
      aud: 'test-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await expect(verifyGoogleToken(oldToken)).resolves.toMatchObject({ sub: 'user-old' });

    // Phase 2: Google rotates keys. The cache still holds only OLD_KID, but a
    // freshly minted token references NEW_KID. Verification must force a single
    // refetch that bypasses the TTL and then succeed.
    currentJwks = newJwks;
    const newToken = await signJwt(NEW_KID, newKeyPair.privateKey, {
      sub: 'user-new',
      email: 'new@example.com',
      email_verified: true,
      name: 'New User',
      aud: 'test-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(verifyGoogleToken(newToken)).resolves.toEqual({
      sub: 'user-new',
      email: 'new@example.com',
      name: 'New User',
    });
  });
});

describe('verifyGoogleToken — email verification', () => {
  function mockJwks(jwksBody: { keys: unknown[] }): void {
    const mockFetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify(jwksBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  }

  function basePayload(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      aud: 'test-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    };
  }

  it('rejects a token with email_verified false (AUTH_INVALID)', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    delete process.env['GOOGLE_CLIENT_IDS'];

    const keyPair = await sharedKeyPairPromise;
    mockJwks(await buildJwksResponse(SHARED_KID, keyPair.publicKey));

    const token = await signJwt(
      SHARED_KID,
      keyPair.privateKey,
      basePayload({ email_verified: false })
    );

    let thrown: unknown;
    try {
      await verifyGoogleToken(token);
    } catch (e) {
      thrown = e;
    }

    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_INVALID');
    expect((thrown as ApiError).statusCode).toBe(401);
  });

  it('rejects a token with email_verified missing (AUTH_INVALID)', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    delete process.env['GOOGLE_CLIENT_IDS'];

    const keyPair = await sharedKeyPairPromise;
    mockJwks(await buildJwksResponse(SHARED_KID, keyPair.publicKey));

    const token = await signJwt(SHARED_KID, keyPair.privateKey, basePayload({}));

    let thrown: unknown;
    try {
      await verifyGoogleToken(token);
    } catch (e) {
      thrown = e;
    }

    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_INVALID');
    expect((thrown as ApiError).statusCode).toBe(401);
  });

  it('accepts a token with email_verified serialized as the string "true"', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    delete process.env['GOOGLE_CLIENT_IDS'];

    const keyPair = await sharedKeyPairPromise;
    mockJwks(await buildJwksResponse(SHARED_KID, keyPair.publicKey));

    const token = await signJwt(
      SHARED_KID,
      keyPair.privateKey,
      basePayload({ email_verified: 'true' })
    );

    await expect(verifyGoogleToken(token)).resolves.toEqual({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });
  });

  it('rejects a token with email_verified serialized as the string "false" (AUTH_INVALID)', async () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    delete process.env['GOOGLE_CLIENT_IDS'];

    const keyPair = await sharedKeyPairPromise;
    mockJwks(await buildJwksResponse(SHARED_KID, keyPair.publicKey));

    const token = await signJwt(
      SHARED_KID,
      keyPair.privateKey,
      basePayload({ email_verified: 'false' })
    );

    let thrown: unknown;
    try {
      await verifyGoogleToken(token);
    } catch (e) {
      thrown = e;
    }

    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('AUTH_INVALID');
    expect((thrown as ApiError).statusCode).toBe(401);
  });
});

describe('getMobileGoogleClientIds', () => {
  it('throws CONFIGURATION_ERROR when GOOGLE_CLIENT_IDS is unset', () => {
    const previousMobileClientIds = process.env['GOOGLE_CLIENT_IDS'];
    delete process.env['GOOGLE_CLIENT_IDS'];

    try {
      expect(() => getMobileGoogleClientIds()).toThrow(
        new ApiError(500, 'GOOGLE_CLIENT_IDS env var must be set', 'CONFIGURATION_ERROR')
      );
    } finally {
      process.env['GOOGLE_CLIENT_IDS'] = previousMobileClientIds;
    }
  });
});
