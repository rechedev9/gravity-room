/**
 * OIDC verifier tests — exercises the real RS256 + JWKS path with Web Crypto.
 * A fresh RSA keypair is generated per test, a token is signed with it, and the
 * JWKS fetch is mocked to return the matching public key. A unique jwksUrl per
 * test avoids the module's per-URL key cache leaking across cases.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyOidcIdToken } from './oidc';
import { ApiError } from '../middleware/error-handler';

const ISSUER = 'https://test.issuer';
const AUDIENCE = 'test-client-id';
const KID = 'test-key-1';

let keyPair: CryptoKeyPair;
let jwksUrl: string;
let urlCounter = 0;
const originalFetch = globalThis.fetch;

async function mintToken(
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {}
): Promise<string> {
  const header = { alg: 'RS256', kid: KID, typ: 'JWT', ...headerOverrides };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'user-sub-1',
    email: 'oidc@example.com',
    email_verified: true,
    aud: AUDIENCE,
    iss: ISSUER,
    exp: now + 600,
    iat: now,
    ...payloadOverrides,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
}

function verify(token: string, expectedNonce?: string) {
  return verifyOidcIdToken({
    token,
    jwksUrl,
    issuers: [ISSUER],
    audiences: [AUDIENCE],
    expectedNonce,
  });
}

function verifyWithIssuerTemplate(token: string) {
  return verifyOidcIdToken({
    token,
    jwksUrl,
    issuers: [],
    audiences: [AUDIENCE],
    issuerTemplates: ['https://login.microsoftonline.com/{tenantid}/v2.0'],
  });
}

beforeEach(async () => {
  keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwk = { ...publicJwk, kid: KID };
  urlCounter += 1;
  jwksUrl = `https://jwks.test/${urlCounter}`;
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('verifyOidcIdToken', () => {
  it('verifies a well-formed token and returns its claims', async () => {
    const claims = await verify(await mintToken());
    expect(claims.sub).toBe('user-sub-1');
    expect(claims.email).toBe('oidc@example.com');
    expect(claims.emailVerified).toBe(true);
  });

  it('normalizes a string "true" email_verified to boolean true (Apple quirk)', async () => {
    const claims = await verify(await mintToken({ email_verified: 'true' }));
    expect(claims.emailVerified).toBe(true);
  });

  it('treats a missing/false email_verified as false', async () => {
    const claims = await verify(await mintToken({ email_verified: undefined }));
    expect(claims.emailVerified).toBe(false);
  });

  it('surfaces Microsoft xms_edov as emailDomainOwnerVerified (default false)', async () => {
    const absent = await verify(await mintToken());
    expect(absent.emailDomainOwnerVerified).toBe(false);

    const proven = await verify(await mintToken({ xms_edov: true }));
    expect(proven.emailDomainOwnerVerified).toBe(true);

    // Accept Azure's string quirk, same as email_verified.
    const stringProven = await verify(await mintToken({ xms_edov: 'true' }));
    expect(stringProven.emailDomainOwnerVerified).toBe(true);
  });

  it('rejects a wrong audience', async () => {
    const token = await mintToken({ aud: 'someone-else' });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('rejects multiple audiences when azp is missing', async () => {
    const token = await mintToken({ aud: [AUDIENCE, 'other-client'] });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('rejects a token whose authorized party is another client', async () => {
    const token = await mintToken({ aud: [AUDIENCE, 'other-client'], azp: 'other-client' });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('accepts multiple audiences when azp identifies this client', async () => {
    const token = await mintToken({ aud: [AUDIENCE, 'other-client'], azp: AUDIENCE });
    await expect(verify(token)).resolves.toMatchObject({ sub: 'user-sub-1' });
  });

  it('rejects a wrong issuer', async () => {
    const token = await mintToken({ iss: 'https://evil.issuer' });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('accepts an issuer template resolved with the token tenant id', async () => {
    const token = await mintToken({
      tid: '9188040d-6c67-4c5b-b112-36a304b66dad',
      iss: 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
    });
    const claims = await verifyWithIssuerTemplate(token);
    expect(claims.sub).toBe('user-sub-1');
  });

  it('rejects a token when the expected nonce does not match', async () => {
    const token = await mintToken({ nonce: 'nonce-from-token' });
    expect(verify(token, 'nonce-from-cookie')).rejects.toThrow(ApiError);
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await mintToken({ exp: past, iat: past - 600 });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('rejects a non-RS256 algorithm', async () => {
    const token = await mintToken({}, { alg: 'HS256' });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('rejects a tampered payload (signature mismatch)', async () => {
    const token = await mintToken();
    const [h, , s] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker',
        aud: AUDIENCE,
        iss: ISSUER,
        exp: Math.floor(Date.now() / 1000) + 600,
      })
    ).toString('base64url');
    expect(verify(`${h}.${forgedPayload}.${s}`)).rejects.toThrow(ApiError);
  });

  it('rejects a malformed token (not 3 segments)', async () => {
    expect(verify('not.a.jwt.token')).rejects.toThrow(ApiError);
    expect(verify('onlyonesegment')).rejects.toThrow(ApiError);
  });

  it('rejects malformed JWT JSON as an auth error, not an unhandled parser error', async () => {
    const malformedHeader = Buffer.from('not json').toString('base64url');
    const validPayload = Buffer.from(
      JSON.stringify({
        sub: 'user-sub-1',
        aud: AUDIENCE,
        iss: ISSUER,
        exp: Math.floor(Date.now() / 1000) + 600,
      })
    ).toString('base64url');

    await expect(verify(`${malformedHeader}.${validPayload}.signature`)).rejects.toThrow(ApiError);
  });
});
