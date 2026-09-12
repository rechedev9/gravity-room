const DEVELOPMENT_CLEARTEXT_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

export function resolveApiBaseUrl(
  configuredApiUrl: string | undefined,
  isDevelopment: boolean
): string {
  const configured = configuredApiUrl?.trim();
  if (!configured) {
    if (!isDevelopment) {
      throw new Error('EXPO_PUBLIC_API_URL is required in production builds');
    }
    return 'http://localhost:3001';
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must not contain credentials, query, or fragment');
  }

  if (url.protocol === 'https:') {
    return configured;
  }

  if (isDevelopment && url.protocol === 'http:' && DEVELOPMENT_CLEARTEXT_HOSTS.has(url.hostname)) {
    return configured;
  }

  throw new Error(
    isDevelopment
      ? 'Cleartext EXPO_PUBLIC_API_URL is allowed only for local development hosts'
      : 'EXPO_PUBLIC_API_URL must use https:// in production builds'
  );
}

function readApiPrefix(requestUrl: URL): string {
  const configuredPath = requestUrl.pathname.replace(/\/$/, '');
  if (configuredPath.length === 0 || configuredPath === '/') {
    return '/api';
  }

  return configuredPath;
}

function normalizePath(path: string): URL {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, 'http://localhost');
}

export function buildApiRequestUrl(
  path: string,
  configuredApiUrl: string | undefined,
  isDevelopment: boolean
): string {
  const requestUrl = new URL(resolveApiBaseUrl(configuredApiUrl, isDevelopment));
  const normalizedPath = normalizePath(path);
  requestUrl.pathname = `${readApiPrefix(requestUrl)}${normalizedPath.pathname}`;
  requestUrl.search = normalizedPath.search;
  return requestUrl.toString();
}
