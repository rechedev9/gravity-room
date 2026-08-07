import { getApiBaseUrl, getWebBaseUrl } from '../lib/app-url';
import { ApiError } from '../middleware/error-handler';

export type DeviceType = 'Mobile' | 'Desktop' | 'Bot' | 'Unknown';

/** Maximum accepted avatar data URL length (roughly a 150KB decoded image). */
export const MAX_AVATAR_DATA_URL_CHARS = 200_000;

const DATA_URL_IMAGE_RE =
  /^data:image\/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Classifies the device type from the User-Agent header value. */
export function classifyDevice(userAgent: string | undefined): DeviceType {
  if (!userAgent) return 'Unknown';
  const normalizedUserAgent = userAgent.toLowerCase();
  if (
    normalizedUserAgent.includes('bot') ||
    normalizedUserAgent.includes('crawler') ||
    normalizedUserAgent.includes('spider')
  ) {
    return 'Bot';
  }
  if (/Mobile|Android|iPhone|iPad|iPod/.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

export function normalizeDisplayName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new ApiError(400, 'Name cannot be blank', 'INVALID_NAME');
  }
  return normalized;
}

/**
 * Browser credential endpoints are JSON-only and reject hostile browser
 * origins/fetch metadata. Native clients send JSON without Origin or
 * Sec-Fetch-Site and remain supported.
 */
export function assertTrustedCredentialRequest(request: Request): void {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE');
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite === 'cross-site') {
    throw new ApiError(403, 'Cross-site authentication request rejected', 'CSRF_REJECTED');
  }

  const origin = request.headers.get('origin');
  if (!origin) return;
  const allowedOrigins = new Set([
    new URL(request.url).origin,
    getApiBaseUrl(request),
    getWebBaseUrl(request),
  ]);
  for (const configured of process.env['CORS_ORIGIN']?.split(',') ?? []) {
    const value = configured.trim();
    if (value) allowedOrigins.add(new URL(value).origin);
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new ApiError(403, 'Cross-origin authentication request rejected', 'CSRF_REJECTED');
  }
  if (!allowedOrigins.has(requestOrigin)) {
    throw new ApiError(403, 'Cross-origin authentication request rejected', 'CSRF_REJECTED');
  }
}

/**
 * Validates the data URL syntax and verifies the decoded bytes match the
 * declared raster format. Passing null or undefined means no avatar payload.
 */
export function assertValidAvatarDataUrl(avatarUrl: string | null | undefined): void {
  if (avatarUrl === undefined || avatarUrl === null) return;

  const dataUrlMatch = DATA_URL_IMAGE_RE.exec(avatarUrl);
  if (!dataUrlMatch) {
    throw new ApiError(
      400,
      'Avatar must be a base64 data URL (JPEG, PNG, or WebP)',
      'INVALID_AVATAR'
    );
  }
  if (avatarUrl.length > MAX_AVATAR_DATA_URL_CHARS) {
    throw new ApiError(400, 'Avatar exceeds maximum size (200KB)', 'AVATAR_TOO_LARGE');
  }

  const declaredType = dataUrlMatch[1];
  const base64Payload = avatarUrl.split(',')[1];
  if (!base64Payload) {
    throw new ApiError(400, 'Empty avatar data', 'INVALID_AVATAR');
  }

  const decoded = Buffer.from(base64Payload, 'base64');
  if (decoded.toString('base64') !== base64Payload) {
    throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
  }
  if (declaredType === undefined || !avatarSignatureMatches(declaredType, decoded)) {
    throw new ApiError(
      400,
      'Avatar data is not a valid image of the declared type',
      'INVALID_AVATAR'
    );
  }
}

function avatarSignatureMatches(declaredType: string, buffer: Buffer): boolean {
  switch (declaredType) {
    case 'jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case 'webp':
      return (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}
