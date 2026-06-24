/**
 * Sign in with Apple — server-side ID-token flow.
 *
 * We use response_type="code id_token" with response_mode="form_post": Apple
 * POSTs a signed ID token straight to our callback, which we verify against
 * Apple's JWKS. This needs only the Service ID (APPLE_CLIENT_ID) as the
 * audience — no client secret / .p8 key, which are only required to call
 * Apple's token endpoint (not used for plain sign-in). CSP stays `script-src
 * 'self'`: no Apple JS SDK is loaded in the browser.
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { ApiError } from '../middleware/error-handler';
import { verifyOidcIdToken, type OidcClaims } from './oidc';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

/** True when Apple sign-in is configured (Service ID present). */
export function isAppleConfigured(): boolean {
  return Boolean(process.env['APPLE_CLIENT_ID']?.trim());
}

function getAppleClientId(): string {
  const clientId = process.env['APPLE_CLIENT_ID']?.trim();
  if (!clientId)
    throw new ApiError(503, 'Apple sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return clientId;
}

/** Builds the Apple authorization URL the browser is redirected to. */
export function buildAppleAuthorizeUrl(state: string, redirectUri: string, nonce?: string): string {
  const params = new URLSearchParams({
    client_id: getAppleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });
  if (nonce) params.set('nonce', nonce);
  return `${APPLE_AUTHORIZE_URL}?${params.toString()}`;
}

/** Verifies an Apple ID token from the callback against Apple's JWKS. */
export async function verifyAppleIdToken(
  idToken: string,
  expectedNonce?: string
): Promise<OidcClaims> {
  return verifyOidcIdToken({
    token: idToken,
    jwksUrl: APPLE_JWKS_URL,
    issuers: [APPLE_ISSUER],
    audiences: [getAppleClientId()],
    expectedNonce,
  });
}

/**
 * Apple sends the user's name only on the FIRST authorization, as a JSON string
 * in the `user` form field (e.g. `{"name":{"firstName":"A","lastName":"B"}}`).
 * Returns a display name, or undefined.
 */
export function parseAppleUserName(userField: string | undefined): string | undefined {
  if (!userField) return undefined;
  try {
    const parsed: unknown = JSON.parse(userField);
    if (!isRecord(parsed) || !isRecord(parsed['name'])) return undefined;
    const name = parsed['name'];
    const first = typeof name['firstName'] === 'string' ? name['firstName'] : '';
    const last = typeof name['lastName'] === 'string' ? name['lastName'] : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full.length > 0 ? full : undefined;
  } catch {
    return undefined;
  }
}
