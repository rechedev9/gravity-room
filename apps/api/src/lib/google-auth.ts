/**
 * Google ID token verification using Web Crypto + JWKS (RS256).
 * No google-auth-library dependency — pure Web Crypto API.
 */
import { isRecord } from '@gzclp/shared/type-guards';
import { ApiError } from '../middleware/error-handler';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  readonly name?: string;
  readonly aud: string | string[];
  readonly iss: string;
  readonly exp: number;
}

function isIdTokenPayload(value: unknown): value is IdTokenPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value['sub'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['exp'] === 'number' &&
    (typeof value['aud'] === 'string' || Array.isArray(value['aud']))
  );
}

// ---------------------------------------------------------------------------
// JWKS cache
// ---------------------------------------------------------------------------

interface JwksCache {
  readonly keys: GoogleJwk[];
  readonly fetchedAt: number;
}

let jwksCache: JwksCache | null = null;

async function fetchGoogleCerts(): Promise<GoogleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new ApiError(503, 'Google JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

  const rawData: unknown = await res.json();
  if (!isJwksResponse(rawData))
    throw new ApiError(503, 'Invalid JWKS response format', 'AUTH_JWKS_UNAVAILABLE');

  jwksCache = { keys: rawData.keys, fetchedAt: Date.now() };
  return rawData.keys;
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/** Verifies a Google ID token (RS256) against Google's JWKS. */
export async function verifyGoogleToken(credential: string): Promise<GoogleTokenPayload> {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId)
    throw new ApiError(500, 'GOOGLE_CLIENT_ID env var must be set', 'CONFIGURATION_ERROR');

  const parts = credential.split('.');
  if (parts.length !== 3)
    throw new ApiError(401, 'Invalid JWT format: expected 3 segments', 'AUTH_INVALID');

  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';

  const rawHeader: unknown = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  if (!isIdTokenHeader(rawHeader)) throw new ApiError(401, 'Invalid JWT header', 'AUTH_INVALID');

  if (rawHeader.alg !== 'RS256')
    throw new ApiError(401, 'Unsupported token algorithm', 'AUTH_INVALID');

  const keys = await fetchGoogleCerts();
  const jwk = keys.find((k) => k.kid === rawHeader.kid);
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

  const rawPayload: unknown = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (!isIdTokenPayload(rawPayload)) throw new ApiError(401, 'Invalid JWT payload', 'AUTH_INVALID');

  // Validate standard claims
  if (Date.now() / 1000 > rawPayload.exp)
    throw new ApiError(401, 'Token has expired', 'AUTH_INVALID');

  if (!GOOGLE_ISSUERS.has(rawPayload.iss)) {
    throw new ApiError(401, 'Invalid token issuer', 'AUTH_INVALID');
  }

  const audiences = Array.isArray(rawPayload.aud) ? rawPayload.aud : [rawPayload.aud];
  if (!audiences.includes(clientId)) throw new ApiError(401, 'Invalid audience', 'AUTH_INVALID');

  return {
    sub: rawPayload.sub,
    email: rawPayload.email,
    name: rawPayload.name,
  };
}
