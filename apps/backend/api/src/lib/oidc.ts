/**
 * Generic OIDC ID-token verification (RS256 + provider JWKS), built on Web
 * Crypto — no external dependency. Used for providers whose ID tokens we verify
 * server-side (Apple). Google keeps its own dedicated, separately-tested
 * verifier in `google-auth.ts`; this module covers the rest with the same
 * proven algorithm (signature + iss/aud/exp/nbf validation).
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { ApiError } from '../middleware/error-handler';

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLOCK_SKEW_S = 60;

interface Jwk {
  readonly kid: string;
  readonly kty: string;
  readonly n: string;
  readonly e: string;
}

function isJwk(value: unknown): value is Jwk {
  return (
    isRecord(value) &&
    typeof value['kid'] === 'string' &&
    typeof value['kty'] === 'string' &&
    typeof value['n'] === 'string' &&
    typeof value['e'] === 'string'
  );
}

function isJwksResponse(value: unknown): value is { keys: Jwk[] } {
  return isRecord(value) && Array.isArray(value['keys']) && value['keys'].every(isJwk);
}

interface TokenHeader {
  readonly kid: string;
  readonly alg: string;
}

function isTokenHeader(value: unknown): value is TokenHeader {
  return isRecord(value) && typeof value['kid'] === 'string' && typeof value['alg'] === 'string';
}

interface OidcTokenPayload {
  readonly sub: string;
  readonly email?: string;
  readonly email_verified?: boolean | string;
  readonly name?: string;
  readonly aud: string | string[];
  readonly iss: string;
  readonly exp: number;
  readonly nbf?: number;
  readonly iat?: number;
}

function isOidcTokenPayload(value: unknown): value is OidcTokenPayload {
  if (!isRecord(value)) return false;
  if (value['nbf'] !== undefined && typeof value['nbf'] !== 'number') return false;
  if (value['iat'] !== undefined && typeof value['iat'] !== 'number') return false;
  return (
    typeof value['sub'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['exp'] === 'number' &&
    (typeof value['aud'] === 'string' || Array.isArray(value['aud']))
  );
}

// Apple emits `email_verified` as the boolean true or the string "true".
function normalizeEmailVerified(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

// ---------------------------------------------------------------------------
// Per-provider JWKS cache (keyed by URL)
// ---------------------------------------------------------------------------

interface JwksCacheEntry {
  readonly keys: Jwk[];
  readonly fetchedAt: number;
}

const jwksCaches = new Map<string, JwksCacheEntry>();

async function fetchJwks(jwksUrl: string): Promise<Jwk[]> {
  const cached = jwksCaches.get(jwksUrl);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok)
    throw new ApiError(503, 'Provider JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

  const rawData: unknown = await res.json();
  if (!isJwksResponse(rawData))
    throw new ApiError(503, 'Invalid JWKS response format', 'AUTH_JWKS_UNAVAILABLE');

  jwksCaches.set(jwksUrl, { keys: rawData.keys, fetchedAt: Date.now() });
  return rawData.keys;
}

export interface OidcClaims {
  readonly sub: string;
  readonly email: string | undefined;
  readonly emailVerified: boolean;
  readonly name: string | undefined;
}

export interface VerifyOidcOptions {
  readonly token: string;
  readonly jwksUrl: string;
  readonly issuers: readonly string[];
  readonly audiences: readonly string[];
}

/** Verifies a provider ID token (RS256) against its JWKS and standard claims. */
export async function verifyOidcIdToken(opts: VerifyOidcOptions): Promise<OidcClaims> {
  const parts = opts.token.split('.');
  if (parts.length !== 3)
    throw new ApiError(401, 'Invalid JWT format: expected 3 segments', 'AUTH_INVALID');

  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';

  const rawHeader: unknown = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  if (!isTokenHeader(rawHeader)) throw new ApiError(401, 'Invalid JWT header', 'AUTH_INVALID');
  if (rawHeader.alg !== 'RS256')
    throw new ApiError(401, 'Unsupported token algorithm', 'AUTH_INVALID');

  const keys = await fetchJwks(opts.jwksUrl);
  const jwk = keys.find((k) => k.kid === rawHeader.kid);
  if (!jwk) throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signatureB64, 'base64url'),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!isValid) throw new ApiError(401, 'Invalid JWT signature', 'AUTH_INVALID');

  const rawPayload: unknown = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (!isOidcTokenPayload(rawPayload))
    throw new ApiError(401, 'Invalid JWT payload', 'AUTH_INVALID');

  const nowS = Date.now() / 1000;
  if (nowS - CLOCK_SKEW_S > rawPayload.exp)
    throw new ApiError(401, 'Token has expired', 'AUTH_INVALID');
  if (rawPayload.nbf !== undefined && nowS + CLOCK_SKEW_S < rawPayload.nbf)
    throw new ApiError(401, 'Token not yet valid', 'AUTH_INVALID');
  if (rawPayload.iat !== undefined && nowS + CLOCK_SKEW_S < rawPayload.iat)
    throw new ApiError(401, 'Token issued in the future', 'AUTH_INVALID');

  if (!opts.issuers.includes(rawPayload.iss))
    throw new ApiError(401, 'Invalid token issuer', 'AUTH_INVALID');

  const audiences = Array.isArray(rawPayload.aud) ? rawPayload.aud : [rawPayload.aud];
  if (!audiences.some((audience) => opts.audiences.includes(audience)))
    throw new ApiError(401, 'Invalid audience', 'AUTH_INVALID');

  return {
    sub: rawPayload.sub,
    email: rawPayload.email,
    emailVerified: normalizeEmailVerified(rawPayload.email_verified),
    name: rawPayload.name,
  };
}
