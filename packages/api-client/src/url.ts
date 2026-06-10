/**
 * Build a full API URL from a base URL and a path segment.
 *
 * - Strips a trailing slash from baseUrl.
 * - Ensures path starts with a leading slash.
 *
 * @example
 * buildApiUrl('http://localhost:3001', '/auth/me')
 * // => 'http://localhost:3001/auth/me'
 *
 * buildApiUrl('http://localhost:3001/', 'auth/me')
 * // => 'http://localhost:3001/auth/me'
 */
export function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
