/**
 * Public base URLs derived from env or the incoming request, shared by the email
 * and social-auth flows.
 *
 * On the same-origin Vercel deployment the SPA and API share one origin, so the
 * request's forwarded host IS the public domain for both. We therefore prefer an
 * explicit env override (set it and it wins) and otherwise derive the origin from
 * the request, falling back to localhost only when neither is available. This
 * keeps split-origin local dev (CORS_ORIGIN / API_PUBLIC_URL set) working while
 * removing the production footgun where an unset var silently pointed OAuth
 * redirects and email links at localhost.
 */

export const DEFAULT_DEV_WEB_ORIGIN = 'http://localhost:5173';

/** scheme://host from the incoming request (Vercel sets x-forwarded-proto/host). */
function originFromRequest(request: Request | undefined): string | undefined {
  if (!request) return undefined;
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.trim();
  if (!host) return undefined;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}

/**
 * Public base URL of the web SPA (action links + post-login redirects). Prefers
 * CORS_ORIGIN (set only for split-origin local dev); on the same-origin prod
 * deployment CORS_ORIGIN is empty, so it derives the origin from the request.
 */
export function getWebBaseUrl(request?: Request): string {
  const configured = process.env['CORS_ORIGIN']?.split(',')[0]?.trim();
  if (configured && configured.length > 0) return configured.replace(/\/$/, '');
  const fromRequest = originFromRequest(request);
  if (fromRequest) {
    const url = new URL(fromRequest);
    const isLocalApi =
      process.env['NODE_ENV'] !== 'production' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') &&
      url.port === '3001';
    return isLocalApi ? DEFAULT_DEV_WEB_ORIGIN : fromRequest;
  }
  return DEFAULT_DEV_WEB_ORIGIN;
}

/**
 * Public base URL of this API, used to build OAuth/OIDC redirect URIs that must
 * match what is registered in the provider console. Prefers API_PUBLIC_URL (set
 * it to pin the value the provider expects); otherwise derives it from the
 * request host, which on Vercel is the public domain.
 */
export function getApiBaseUrl(request?: Request): string {
  const url = process.env['API_PUBLIC_URL']?.trim();
  if (url && url.length > 0) return url.replace(/\/$/, '');
  const fromRequest = originFromRequest(request);
  if (fromRequest) return fromRequest;
  return 'http://localhost:3001';
}
