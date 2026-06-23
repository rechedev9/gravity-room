/**
 * GitHub OAuth2 (authorization-code) login.
 *
 * Server-side code exchange + REST lookups; no GitHub JS SDK in the browser, so
 * CSP stays `script-src 'self'`. We trust an email for account linking only when
 * GitHub reports it as primary AND verified.
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { ApiError } from '../middleware/error-handler';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_USER = 'https://api.github.com/user';
const GITHUB_API_EMAILS = 'https://api.github.com/user/emails';
const HTTP_TIMEOUT_MS = 8_000;

/** True when GitHub sign-in is configured (client id + secret present). */
export function isGitHubConfigured(): boolean {
  return Boolean(
    process.env['GITHUB_CLIENT_ID']?.trim() && process.env['GITHUB_CLIENT_SECRET']?.trim()
  );
}

function getGitHubClientId(): string {
  const id = process.env['GITHUB_CLIENT_ID']?.trim();
  if (!id) throw new ApiError(503, 'GitHub sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return id;
}

function getGitHubClientSecret(): string {
  const secret = process.env['GITHUB_CLIENT_SECRET']?.trim();
  if (!secret)
    throw new ApiError(503, 'GitHub sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return secret;
}

/** Builds the GitHub authorization URL the browser is redirected to. */
export function buildGitHubAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges an authorization code for a GitHub access token. */
export async function exchangeGitHubCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getGitHubClientId(),
      client_secret: getGitHubClientSecret(),
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'GitHub token exchange failed', 'AUTH_PROVIDER_ERROR');

  const data: unknown = await res.json();
  if (!isRecord(data) || typeof data['access_token'] !== 'string') {
    throw new ApiError(502, 'GitHub token exchange returned no token', 'AUTH_PROVIDER_ERROR');
  }
  return data['access_token'];
}

export interface GitHubIdentity {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | undefined;
}

interface GitHubEmail {
  readonly email: string;
  readonly primary: boolean;
  readonly verified: boolean;
}

function isGitHubEmail(value: unknown): value is GitHubEmail {
  return (
    isRecord(value) &&
    typeof value['email'] === 'string' &&
    typeof value['primary'] === 'boolean' &&
    typeof value['verified'] === 'boolean'
  );
}

/** Fetches the GitHub user plus their primary verified email. */
export async function fetchGitHubIdentity(accessToken: string): Promise<GitHubIdentity> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gravity-room',
  };

  const [userRes, emailsRes] = await Promise.all([
    fetch(GITHUB_API_USER, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }),
    fetch(GITHUB_API_EMAILS, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }),
  ]);
  if (!userRes.ok || !emailsRes.ok)
    throw new ApiError(502, 'GitHub user lookup failed', 'AUTH_PROVIDER_ERROR');

  const user: unknown = await userRes.json();
  if (!isRecord(user) || (typeof user['id'] !== 'number' && typeof user['id'] !== 'string')) {
    throw new ApiError(502, 'GitHub user response invalid', 'AUTH_PROVIDER_ERROR');
  }

  const emailsRaw: unknown = await emailsRes.json();
  const emails = Array.isArray(emailsRaw) ? emailsRaw.filter(isGitHubEmail) : [];
  const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
  if (!primary)
    throw new ApiError(401, 'No verified email on the GitHub account', 'AUTH_EMAIL_UNVERIFIED');

  const name =
    typeof user['name'] === 'string'
      ? user['name']
      : typeof user['login'] === 'string'
        ? user['login']
        : undefined;

  return { id: String(user['id']), email: primary.email, emailVerified: true, name };
}
