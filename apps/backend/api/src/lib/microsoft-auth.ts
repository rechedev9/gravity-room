/**
 * Microsoft identity platform OAuth/OIDC login.
 *
 * Uses the authorization-code flow with PKCE and validates the ID token against
 * Microsoft JWKS before linking the account. The default tenant is "consumers"
 * so Outlook/Microsoft personal accounts work out of the box; deployments may
 * set MICROSOFT_TENANT_ID for a tenant-specific or multi-tenant app.
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { ApiError } from '../middleware/error-handler';
import { verifyOidcIdToken } from './oidc';
import { MAX_PROVIDER_JSON_BYTES, readBoundedJson } from './bounded-json';

const MICROSOFT_LOGIN_BASE = 'https://login.microsoftonline.com';
const MICROSOFT_CONSUMERS_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';
const MICROSOFT_USERINFO_URL = 'https://graph.microsoft.com/oidc/userinfo';
const MICROSOFT_SCOPE = 'openid email profile';
const HTTP_TIMEOUT_MS = 8_000;

export interface MicrosoftTokenSet {
  readonly idToken: string;
  readonly accessToken: string;
}

export interface MicrosoftIdentity {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | undefined;
}

interface MicrosoftUserInfo {
  readonly email?: string;
  readonly name?: string;
}

/** True when Microsoft sign-in is configured (client id + secret present). */
export function isMicrosoftConfigured(): boolean {
  return Boolean(
    process.env['MICROSOFT_CLIENT_ID']?.trim() && process.env['MICROSOFT_CLIENT_SECRET']?.trim()
  );
}

function microsoftTenant(): string {
  return process.env['MICROSOFT_TENANT_ID']?.trim() || 'consumers';
}

function getMicrosoftClientId(): string {
  const id = process.env['MICROSOFT_CLIENT_ID']?.trim();
  if (!id)
    throw new ApiError(503, 'Microsoft sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return id;
}

function getMicrosoftClientSecret(): string {
  const secret = process.env['MICROSOFT_CLIENT_SECRET']?.trim();
  if (!secret)
    throw new ApiError(503, 'Microsoft sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return secret;
}

function microsoftAuthorizeUrl(): string {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/oauth2/v2.0/authorize`;
}

function microsoftTokenUrl(): string {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/oauth2/v2.0/token`;
}

function microsoftJwksUrl(): string {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/discovery/v2.0/keys`;
}

function microsoftIssuers(): {
  readonly issuers: readonly string[];
  readonly issuerTemplates: readonly string[];
} {
  const tenant = microsoftTenant();
  if (tenant === 'consumers') {
    return {
      issuers: [`${MICROSOFT_LOGIN_BASE}/${MICROSOFT_CONSUMERS_TENANT_ID}/v2.0`],
      issuerTemplates: [],
    };
  }
  if (tenant === 'common' || tenant === 'organizations') {
    return {
      issuers: [],
      issuerTemplates: [`${MICROSOFT_LOGIN_BASE}/{tenantid}/v2.0`],
    };
  }
  return {
    issuers: [`${MICROSOFT_LOGIN_BASE}/${tenant}/v2.0`],
    issuerTemplates: [],
  };
}

/** Builds the Microsoft authorization URL the browser is redirected to. */
export function buildMicrosoftAuthorizeUrl(
  state: string,
  redirectUri: string,
  nonce: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: MICROSOFT_SCOPE,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${microsoftAuthorizeUrl()}?${params.toString()}`;
}

/** Exchanges an authorization code for Microsoft ID/access tokens. */
export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<MicrosoftTokenSet> {
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPE,
    code_verifier: codeVerifier,
  });

  const res = await fetch(microsoftTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'Microsoft token exchange failed', 'AUTH_PROVIDER_ERROR');

  const data = await readBoundedJson(
    res,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'Microsoft token response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (
    !isRecord(data) ||
    typeof data['id_token'] !== 'string' ||
    typeof data['access_token'] !== 'string'
  ) {
    throw new ApiError(502, 'Microsoft token exchange returned no token', 'AUTH_PROVIDER_ERROR');
  }
  return { idToken: data['id_token'], accessToken: data['access_token'] };
}

async function fetchMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
  const res = await fetch(MICROSOFT_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'Microsoft user lookup failed', 'AUTH_PROVIDER_ERROR');

  const data = await readBoundedJson(
    res,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'Microsoft user response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (!isRecord(data))
    throw new ApiError(502, 'Microsoft user response invalid', 'AUTH_PROVIDER_ERROR');

  return {
    email: typeof data['email'] === 'string' ? data['email'] : undefined,
    name: typeof data['name'] === 'string' ? data['name'] : undefined,
  };
}

/** Verifies the Microsoft ID token and returns an app-linkable identity. */
export async function fetchMicrosoftIdentity(
  idToken: string,
  accessToken: string,
  expectedNonce: string
): Promise<MicrosoftIdentity> {
  const { issuers, issuerTemplates } = microsoftIssuers();
  const claims = await verifyOidcIdToken({
    token: idToken,
    jwksUrl: microsoftJwksUrl(),
    issuers,
    issuerTemplates,
    audiences: [getMicrosoftClientId()],
    expectedNonce,
  });

  const userInfo = claims.email ? undefined : await fetchMicrosoftUserInfo(accessToken);
  const email = claims.email ?? userInfo?.email;
  if (!email) throw new ApiError(401, 'No email on the Microsoft account', 'AUTH_EMAIL_UNVERIFIED');

  return {
    id: claims.sub,
    email,
    emailVerified: true,
    name: claims.name ?? userInfo?.name,
  };
}
