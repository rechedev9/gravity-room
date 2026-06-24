import { describe, it, expect, beforeAll, beforeEach, afterEach, mock } from 'bun:test';
import { ApiError } from '../middleware/error-handler';
import {
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftCode,
  fetchMicrosoftIdentity,
  isMicrosoftConfigured,
} from './microsoft-auth';

const ORIG_ID = process.env['MICROSOFT_CLIENT_ID'];
const ORIG_SECRET = process.env['MICROSOFT_CLIENT_SECRET'];
const ORIG_TENANT = process.env['MICROSOFT_TENANT_ID'];
const originalFetch = globalThis.fetch;
const KID = 'microsoft-test-key';
const ISSUER = 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0';
const AUDIENCE = 'ms-client';

let keyPair: CryptoKeyPair;
let jwk: Record<string, unknown> & { kid: string };

function restoreEnv(key: string, val: string | undefined): void {
  if (val === undefined) delete process.env[key];
  else process.env[key] = val;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function mintMicrosoftToken(payloadOverrides: Record<string, unknown> = {}): Promise<string> {
  const header = { alg: 'RS256', kid: KID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'ms-sub',
    email: 'microsoft@example.com',
    email_verified: true,
    aud: AUDIENCE,
    iss: ISSUER,
    exp: now + 600,
    iat: now,
    nonce: 'nonce-1',
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

function mockMicrosoftFetch(
  userInfo: unknown = { email: 'userinfo@example.com', name: 'User Info' }
): void {
  globalThis.fetch = mock((input: unknown) => {
    const url = String(input);
    if (url.endsWith('/discovery/v2.0/keys')) {
      return Promise.resolve(jsonResponse({ keys: [jwk] }));
    }
    if (url === 'https://graph.microsoft.com/oidc/userinfo') {
      return Promise.resolve(jsonResponse(userInfo));
    }
    return Promise.resolve(jsonResponse({}, 404));
  }) as unknown as typeof fetch;
}

beforeAll(async () => {
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
  jwk = { ...publicJwk, kid: KID };
});

beforeEach(() => {
  process.env['MICROSOFT_CLIENT_ID'] = AUDIENCE;
  process.env['MICROSOFT_CLIENT_SECRET'] = 'ms-secret';
  delete process.env['MICROSOFT_TENANT_ID'];
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  restoreEnv('MICROSOFT_CLIENT_ID', ORIG_ID);
  restoreEnv('MICROSOFT_CLIENT_SECRET', ORIG_SECRET);
  restoreEnv('MICROSOFT_TENANT_ID', ORIG_TENANT);
  globalThis.fetch = originalFetch;
});

describe('isMicrosoftConfigured', () => {
  it('is false unless both client id and secret are set', () => {
    delete process.env['MICROSOFT_CLIENT_ID'];
    delete process.env['MICROSOFT_CLIENT_SECRET'];
    expect(isMicrosoftConfigured()).toBe(false);
    process.env['MICROSOFT_CLIENT_ID'] = AUDIENCE;
    expect(isMicrosoftConfigured()).toBe(false);
  });

  it('is true with both set', () => {
    expect(isMicrosoftConfigured()).toBe(true);
  });
});

describe('buildMicrosoftAuthorizeUrl', () => {
  it('uses the consumers tenant by default and includes nonce plus PKCE', () => {
    const url = new URL(
      buildMicrosoftAuthorizeUrl(
        'state-1',
        'https://api.example.com/api/auth/microsoft/callback',
        'nonce-1',
        'challenge-1'
      )
    );
    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
    );
    expect(url.searchParams.get('client_id')).toBe(AUDIENCE);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/auth/microsoft/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('nonce')).toBe('nonce-1');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('exchangeMicrosoftCode', () => {
  it('posts an authorization-code form with the PKCE verifier', async () => {
    const calls: unknown[] = [];
    globalThis.fetch = mock((input: unknown, init?: RequestInit) => {
      calls.push({ input, init });
      return Promise.resolve(jsonResponse({ id_token: 'id-token', access_token: 'access-token' }));
    }) as unknown as typeof fetch;

    const token = await exchangeMicrosoftCode('code-1', 'https://cb', 'verifier-1');

    expect(token).toEqual({ idToken: 'id-token', accessToken: 'access-token' });
    expect((calls[0] as { input: string }).input).toBe(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    );
    const body = new URLSearchParams(String((calls[0] as { init: RequestInit }).init.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code-1');
    expect(body.get('code_verifier')).toBe('verifier-1');
  });

  it('throws when the token response is missing tokens', async () => {
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({}))) as unknown as typeof fetch;
    expect(exchangeMicrosoftCode('code-1', 'https://cb', 'verifier-1')).rejects.toThrow(ApiError);
  });
});

describe('fetchMicrosoftIdentity', () => {
  it('uses the verified ID-token email when present', async () => {
    mockMicrosoftFetch();
    const identity = await fetchMicrosoftIdentity(
      await mintMicrosoftToken(),
      'access-token',
      'nonce-1'
    );
    expect(identity).toEqual({
      id: 'ms-sub',
      email: 'microsoft@example.com',
      emailVerified: true,
      name: undefined,
    });
  });

  it('falls back to the UserInfo endpoint when the ID token omits email', async () => {
    mockMicrosoftFetch({ email: 'userinfo@example.com', name: 'User Info' });
    const identity = await fetchMicrosoftIdentity(
      await mintMicrosoftToken({ email: undefined, email_verified: undefined }),
      'access-token',
      'nonce-1'
    );

    expect(identity.email).toBe('userinfo@example.com');
    expect(identity.name).toBe('User Info');
  });
});
