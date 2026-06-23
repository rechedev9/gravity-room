/**
 * Public base URLs derived from env, shared by the email and social-auth flows.
 */

/** First configured web origin (action links + post-login redirects). */
export function getWebBaseUrl(): string {
  const first = process.env['CORS_ORIGIN']?.split(',')[0]?.trim();
  return first && first.length > 0 ? first.replace(/\/$/, '') : 'http://localhost:5173';
}

/**
 * Public base URL of this API, used to build OAuth/OIDC redirect URIs that must
 * match what is registered in the provider console. Set API_PUBLIC_URL in prod.
 */
export function getApiBaseUrl(): string {
  const url = process.env['API_PUBLIC_URL']?.trim();
  return url && url.length > 0 ? url.replace(/\/$/, '') : 'http://localhost:3001';
}
