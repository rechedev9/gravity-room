/**
 * Google ID token verification using Web Crypto + JWKS (RS256).
 * No google-auth-library dependency — pure Web Crypto API.
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { ApiError } from '../middleware/error-handler';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface VerifyGoogleTokenOptions {
  readonly allowedClientIds?: readonly string[];
}

function getAllowedGoogleClientIds(): string[] {
  const clientIds = process.env['GOOGLE_CLIENT_IDS']
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  const allowedClientIds = new Set<string>(clientIds);

  if (clientId) {
    allowedClientIds.add(clientId);
  }

  if (allowedClientIds.size === 0) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID env var must be set', 'CONFIGURATION_ERROR');
  }

  return [...allowedClientIds];
}

export function getWebGoogleClientId(): string {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  if (!clientId) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID env var must be set', 'CONFIGURATION_ERROR');
  }
  return clientId;
}

export function getMobileGoogleClientIds(): string[] {
  const clientIds = process.env['GOOGLE_CLIENT_IDS']
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (clientIds && clientIds.length > 0) {
    return [...new Set(clientIds)];
  }

  throw new ApiError(500, 'GOOGLE_CLIENT_IDS env var must be set', 'CONFIGURATION_ERROR');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoogleJwk {
  readonly kid: string;
  readonly kty: string;
  readonly n: string;
  readonly e: string;
  readonly alg?: string;
  readonly use?: string;
}

export interface GoogleTokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly name: string | undefined;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isGoogleJwk(value: unknown): value is GoogleJwk {
  if (!isRecord(value)) return false;
  return (
    typeof value['kid'] === 'string' &&
    typeof value['kty'] === 'string' &&
    typeof value['n'] === 'string' &&
    typeof value['e'] === 'string'
  );
}

function isJwksResponse(value: unknown): value is { keys: GoogleJwk[] } {
  if (!isRecord(value)) return false;
  return Array.isArray(value['keys']) && value['keys'].every(isGoogleJwk);
}

interface IdTokenHeader {
  readonly kid: string;
  readonly alg: string;
}

function isIdTokenHeader(value: unknown): value is IdTokenHeader {
  if (!isRecord(value)) return false;
  return typeof value['kid'] === 'string' && typeof value['alg'] === 'string';
}

interface IdTokenPayload {
  readonly sub: string;
  readonly email: string;
  // Google sends a boolean, but some libraries serialize it as the string "true".
  readonly email_verified?: boolean | string;
  readonly name?: string;
  readonly aud: string | string[];
  readonly iss: string;
  readonly exp: number;
  readonly nbf?: number;
  readonly iat?: number;
}

function isIdTokenPayload(value: unknown): value is IdTokenPayload {
  if (!isRecord(value)) return false;
  if (
    value['email_verified'] !== undefined &&
    typeof value['email_verified'] !== 'boolean' &&
    typeof value['email_verified'] !== 'string'
  )
    return false;
  if (value['nbf'] !== undefined && typeof value['nbf'] !== 'number') return false;
  if (value['iat'] !== undefined && typeof value['iat'] !== 'number') return false;
  return (
    typeof value['sub'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['exp'] === 'number' &&
    (typeof value['aud'] === 'string' || Array.isArray(value['aud']))
  );
}

function parseJwtJsonSegment(segment: string, label: 'header' | 'payload'): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError(401, `Invalid JWT ${label}`, 'AUTH_INVALID');
  }
}

// ---------------------------------------------------------------------------
// JWKS cache
// ---------------------------------------------------------------------------

interface JwksCache {
  readonly keys: GoogleJwk[];
  readonly fetchedAt: number;
  readonly ttlMs: number;
}

let jwksCache: JwksCache | null = null;

/** Parse the max-age (in ms) from a Cache-Control header, if present and valid. */
function parseCacheControlMaxAgeMs(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const match = /max-age\s*=\s*(\d+)/i.exec(cacheControl);
  if (!match?.[1]) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
}

/**
 * Fetches Google's JWKS, caching it for the response's Cache-Control max-age
 * (falling back to CACHE_TTL_MS). Pass `forceRefresh` to bypass the cache for a
 * single fetch — used to pick up freshly rotated signing keys.
 */
async function fetchGoogleCerts(options?: {
  readonly forceRefresh?: boolean;
}): Promise<GoogleJwk[]> {
  if (!options?.forceRefresh && jwksCache && Date.now() - jwksCache.fetchedAt < jwksCache.ttlMs) {
    return jwksCache.keys;
  }

  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new ApiError(503, 'Google JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

  const rawData: unknown = await res.json();
  if (!isJwksResponse(rawData))
    throw new ApiError(503, 'Invalid JWKS response format', 'AUTH_JWKS_UNAVAILABLE');

  const ttlMs = parseCacheControlMaxAgeMs(res.headers.get('cache-control')) ?? CACHE_TTL_MS;
  jwksCache = { keys: rawData.keys, fetchedAt: Date.now(), ttlMs };
  return rawData.keys;
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/** Verifies a Google ID token (RS256) against Google's JWKS. */
export async function verifyGoogleToken(
  credential: string,
  options?: VerifyGoogleTokenOptions
): Promise<GoogleTokenPayload> {
  const allowedClientIds = options?.allowedClientIds?.length
    ? [...options.allowedClientIds]
    : getAllowedGoogleClientIds();

  const parts = credential.split('.');
  if (parts.length !== 3)
    throw new ApiError(401, 'Invalid JWT format: expected 3 segments', 'AUTH_INVALID');

  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';

  const rawHeader = parseJwtJsonSegment(headerB64, 'header');
  if (!isIdTokenHeader(rawHeader)) throw new ApiError(401, 'Invalid JWT header', 'AUTH_INVALID');

  if (rawHeader.alg !== 'RS256')
    throw new ApiError(401, 'Unsupported token algorithm', 'AUTH_INVALID');

  let keys = await fetchGoogleCerts();
  let jwk = keys.find((k) => k.kid === rawHeader.kid);
  if (!jwk) {
    // The kid may belong to a freshly rotated Google signing key that is not yet
    // in our cached set. Force a single JWKS refetch (bypassing the TTL) and retry
    // the lookup once before rejecting, to avoid spurious 401s during key rotation.
    keys = await fetchGoogleCerts({ forceRefresh: true });
    jwk = keys.find((k) => k.kid === rawHeader.kid);
  }
  if (!jwk) throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');

  // Pass the narrowed JWK fields directly — TypeScript infers compatibility
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    new TextEncoder().encode(signingInput)
  );

  if (!isValid) throw new ApiError(401, 'Invalid JWT signature', 'AUTH_INVALID');

  const rawPayload = parseJwtJsonSegment(payloadB64, 'payload');
  if (!isIdTokenPayload(rawPayload)) throw new ApiError(401, 'Invalid JWT payload', 'AUTH_INVALID');

  // Validate standard claims with ±60 s clock-skew tolerance
  const CLOCK_SKEW_S = 60;
  const nowS = Date.now() / 1000;

  if (nowS - CLOCK_SKEW_S > rawPayload.exp)
    throw new ApiError(401, 'Token has expired', 'AUTH_INVALID');

  if (rawPayload.nbf !== undefined && nowS + CLOCK_SKEW_S < rawPayload.nbf)
    throw new ApiError(401, 'Token not yet valid', 'AUTH_INVALID');

  if (rawPayload.iat !== undefined && nowS + CLOCK_SKEW_S < rawPayload.iat)
    throw new ApiError(401, 'Token issued in the future', 'AUTH_INVALID');

  if (!GOOGLE_ISSUERS.has(rawPayload.iss)) {
    throw new ApiError(401, 'Invalid token issuer', 'AUTH_INVALID');
  }

  const audiences = Array.isArray(rawPayload.aud) ? rawPayload.aud : [rawPayload.aud];
  if (!audiences.some((audience) => allowedClientIds.includes(audience))) {
    throw new ApiError(401, 'Invalid audience', 'AUTH_INVALID');
  }

  // Account identity is derived from the Google email, so it must be verified.
  // Accept boolean true or the string "true"; reject false, "false", or missing.
  if (rawPayload.email_verified !== true && rawPayload.email_verified !== 'true') {
    throw new ApiError(401, 'Email not verified by Google', 'AUTH_INVALID');
  }

  return {
    sub: rawPayload.sub,
    email: rawPayload.email,
    name: rawPayload.name,
  };
}
