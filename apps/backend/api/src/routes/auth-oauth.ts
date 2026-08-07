import { getWebBaseUrl } from '../lib/app-url';
import { ApiError } from '../middleware/error-handler';

export type OAuthProvider = 'apple' | 'github' | 'microsoft';
export type OAuthSameSite = 'lax' | 'none';

export const OAUTH_COOKIE_NAMES = {
  apple: {
    state: 'oauth_apple_state',
    nonce: 'oauth_apple_nonce',
  },
  github: {
    state: 'oauth_github_state',
    pkce: 'oauth_github_pkce',
  },
  microsoft: {
    state: 'oauth_microsoft_state',
    nonce: 'oauth_microsoft_nonce',
    pkce: 'oauth_microsoft_pkce',
  },
} as const satisfies Record<OAuthProvider, Readonly<Record<string, string>>>;

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const OAUTH_COOKIE_PATH = '/api/auth';

interface OAuthCookie {
  readonly value?: unknown;
  set(options: Record<string, unknown>): void;
}

interface OAuthStateCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: OAuthSameSite;
  readonly maxAge: number;
  readonly path: '/api/auth';
}

/** Cookie policy shared by the redirect-based OAuth providers. */
export function oauthStateCookieOptions(
  sameSite: OAuthSameSite,
  isProduction: boolean
): OAuthStateCookieOptions {
  return {
    httpOnly: true,
    secure: isProduction || sameSite === 'none',
    sameSite,
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: OAUTH_COOKIE_PATH,
  };
}

/** Returns a cookie value only when Elysia decoded it as a string. */
export function oauthCookieValue(
  cookie: Pick<OAuthCookie, 'value'> | undefined
): string | undefined {
  return typeof cookie?.value === 'string' ? cookie.value : undefined;
}

/**
 * Expires an OAuth state/nonce/PKCE cookie with the same attributes and Path
 * used when it was created, so the browser actually removes the scoped cookie.
 */
export function removeOAuthStateCookie(
  cookie: Pick<OAuthCookie, 'set'> | undefined,
  sameSite: OAuthSameSite,
  isProduction: boolean
): void {
  if (!cookie) return;
  cookie.set({
    ...oauthStateCookieOptions(sameSite, isProduction),
    value: '',
    maxAge: 0,
    expires: new Date(0),
  });
}

/** Builds the SPA callback URL used after every redirect-based provider flow. */
export function socialCallbackUrl(
  request: Request,
  provider: OAuthProvider,
  error?: string
): string {
  const base = `${getWebBaseUrl(request)}/auth/callback`;
  return error
    ? `${base}?provider=${provider}&error=${encodeURIComponent(error)}`
    : `${base}?provider=${provider}`;
}

/** Maps identity-linking failures to stable, non-sensitive callback codes. */
export function identityErrorCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_DELETED') return 'account_deleted';
    if (error.code === 'ACCOUNT_EXISTS_DIFFERENT_METHOD') return 'account_exists';
  }
  return 'signin_failed';
}

/** Maps provider exchange failures without exposing provider or library errors. */
export function providerExchangeErrorCode(error: unknown): 'email_required' | 'provider_error' {
  return error instanceof ApiError && error.code === 'AUTH_EMAIL_UNVERIFIED'
    ? 'email_required'
    : 'provider_error';
}
