/**
 * OIDC verifier tests — exercises the real RS256 + JWKS path with Web Crypto.
 * A fresh RSA keypair is generated per test, a token is signed with it, and the
 * JWKS fetch is mocked to return the matching public key. A unique jwksUrl per
 * test avoids the module's per-URL key cache leaking across cases.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
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

function verify(token: string) {
  return verifyOidcIdToken({ token, jwksUrl, issuers: [ISSUER], audiences: [AUDIENCE] });
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
  globalThis.fetch = mock(() =>
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

  it('rejects a wrong audience', async () => {
    const token = await mintToken({ aud: 'someone-else' });
    expect(verify(token)).rejects.toThrow(ApiError);
  });

  it('rejects a wrong issuer', async () => {
    const token = await mintToken({ iss: 'https://evil.issuer' });
    expect(verify(token)).rejects.toThrow(ApiError);
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
});
