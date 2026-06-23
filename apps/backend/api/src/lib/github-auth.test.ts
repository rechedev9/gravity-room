import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  isGitHubConfigured,
  buildGitHubAuthorizeUrl,
  exchangeGitHubCode,
  fetchGitHubIdentity,
} from './github-auth';
import { ApiError } from '../middleware/error-handler';

const ORIG_ID = process.env['GITHUB_CLIENT_ID'];
const ORIG_SECRET = process.env['GITHUB_CLIENT_SECRET'];
const originalFetch = globalThis.fetch;

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

afterEach(() => {
  restoreEnv('GITHUB_CLIENT_ID', ORIG_ID);
  restoreEnv('GITHUB_CLIENT_SECRET', ORIG_SECRET);
  globalThis.fetch = originalFetch;
});

describe('isGitHubConfigured', () => {
  it('is false unless both client id and secret are set', () => {
    delete process.env['GITHUB_CLIENT_ID'];
    delete process.env['GITHUB_CLIENT_SECRET'];
    expect(isGitHubConfigured()).toBe(false);
    process.env['GITHUB_CLIENT_ID'] = 'id';
    expect(isGitHubConfigured()).toBe(false);
  });

  it('is true with both set', () => {
    process.env['GITHUB_CLIENT_ID'] = 'id';
    process.env['GITHUB_CLIENT_SECRET'] = 'secret';
    expect(isGitHubConfigured()).toBe(true);
  });
});

describe('buildGitHubAuthorizeUrl', () => {
  beforeEach(() => {
    process.env['GITHUB_CLIENT_ID'] = 'gh-client';
    process.env['GITHUB_CLIENT_SECRET'] = 'gh-secret';
  });

  it('builds the authorize URL with scope and state', () => {
    const url = new URL(
      buildGitHubAuthorizeUrl('st-1', 'https://api.example.com/api/auth/github/callback')
    );
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('gh-client');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('state')).toBe('st-1');
  });
});

describe('exchangeGitHubCode', () => {
  beforeEach(() => {
    process.env['GITHUB_CLIENT_ID'] = 'gh-client';
    process.env['GITHUB_CLIENT_SECRET'] = 'gh-secret';
  });

  it('returns the access token from a successful exchange', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ access_token: 'gho_abc' }))
    ) as unknown as typeof fetch;
    expect(await exchangeGitHubCode('code-1', 'https://cb')).toBe('gho_abc');
  });

  it('throws when no token is returned', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ error: 'bad_verification_code' }))
    ) as unknown as typeof fetch;
    expect(exchangeGitHubCode('code-1', 'https://cb')).rejects.toThrow(ApiError);
  });
});

describe('fetchGitHubIdentity', () => {
  function mockGitHub(user: unknown, emails: unknown): void {
    globalThis.fetch = mock((input: unknown) => {
      const url = String(input);
      return Promise.resolve(jsonResponse(url.endsWith('/user/emails') ? emails : user));
    }) as unknown as typeof fetch;
  }

  it('returns the primary verified email and stringified id', async () => {
    mockGitHub({ id: 4242, name: 'Octo Cat', login: 'octocat' }, [
      { email: 'secondary@example.com', primary: false, verified: true },
      { email: 'octo@example.com', primary: true, verified: true },
    ]);
    const identity = await fetchGitHubIdentity('gho_abc');
    expect(identity.id).toBe('4242');
    expect(identity.email).toBe('octo@example.com');
    expect(identity.emailVerified).toBe(true);
    expect(identity.name).toBe('Octo Cat');
  });

  it('falls back to login when name is null', async () => {
    mockGitHub({ id: 1, name: null, login: 'octocat' }, [
      { email: 'a@b.com', primary: true, verified: true },
    ]);
    expect((await fetchGitHubIdentity('t')).name).toBe('octocat');
  });

  it('throws AUTH_EMAIL_UNVERIFIED when no verified email exists', async () => {
    mockGitHub({ id: 1, login: 'x' }, [{ email: 'a@b.com', primary: true, verified: false }]);
    let thrown: unknown;
    try {
      await fetchGitHubIdentity('t');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe('AUTH_EMAIL_UNVERIFIED');
  });
});
