/**
 * Public base URLs derived from env or the incoming request, shared by the email
 * and social-auth flows.
 *
 * On the same-origin Vercel deployment the SPA and API share one origin, so the
 * Never derive security-sensitive production links from Host/X-Forwarded-Host:
 * those headers can be attacker-controlled outside a correctly configured proxy
 * and would allow verification/reset tokens to be sent to an attacker domain.
 * Production therefore uses explicit configuration or Vercel system env only.
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

function configuredOrigin(raw: string | undefined, name: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(`${name} must be an absolute http(s) origin without credentials or a path`);
  }
  return url.origin;
}

/** Origin supplied by Vercel itself, not by request headers. */
function trustedVercelOrigin(): string | undefined {
  if (process.env['VERCEL'] !== '1') return undefined;
  const host =
    process.env['VERCEL_ENV'] === 'production'
      ? (process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'])
      : (process.env['VERCEL_URL'] ?? process.env['VERCEL_PROJECT_PRODUCTION_URL']);
  if (!host) return undefined;
  return configuredOrigin(`https://${host}`, 'Vercel public URL');
}

function productionOriginError(): never {
  throw new Error(
    'A trusted public origin is required in production; set API_PUBLIC_URL or use Vercel system environment variables'
  );
}

/**
 * Public base URL of the web SPA (action links + post-login redirects). Prefers
 * CORS_ORIGIN (set only for split-origin local dev); on the same-origin prod
 * deployment CORS_ORIGIN is empty, so it derives the origin from the request.
 */
export function getWebBaseUrl(request?: Request): string {
  const configuredWeb = configuredOrigin(process.env['CORS_ORIGIN']?.split(',')[0], 'CORS_ORIGIN');
  if (configuredWeb) return configuredWeb;
  const configuredApi = configuredOrigin(process.env['API_PUBLIC_URL'], 'API_PUBLIC_URL');
  if (configuredApi) return configuredApi;
  const vercel = trustedVercelOrigin();
  if (vercel) return vercel;
  if (process.env['NODE_ENV'] === 'production') return productionOriginError();
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
  const configured = configuredOrigin(process.env['API_PUBLIC_URL'], 'API_PUBLIC_URL');
  if (configured) return configured;
  const vercel = trustedVercelOrigin();
  if (vercel) return vercel;
  if (process.env['NODE_ENV'] === 'production') return productionOriginError();
  const fromRequest = originFromRequest(request);
  if (fromRequest) return fromRequest;
  return 'http://localhost:3001';
}
