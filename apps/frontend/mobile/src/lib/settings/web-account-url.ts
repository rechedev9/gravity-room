import { buildApiRequestUrl } from '../network/api-url';

const DEFAULT_WEB_ORIGIN = 'https://gravityroom.app';

/**
 * The web app lives on the API's own origin in production. A cleartext or loopback API (local
 * development) has no public web page, so those builds point at the public site instead.
 */
export function webAppUrl(
  path: string,
  configuredApiUrl: string | undefined,
  isDevelopment: boolean
): string {
  try {
    const origin = new URL(buildApiRequestUrl('/', configuredApiUrl, isDevelopment)).origin;
    return `${origin.startsWith('https://') ? origin : DEFAULT_WEB_ORIGIN}${path}`;
  } catch {
    return `${DEFAULT_WEB_ORIGIN}${path}`;
  }
}

export function webAccountUrl(): string {
  return webAppUrl('/app/profile', process.env.EXPO_PUBLIC_API_URL, __DEV__);
}

export function webPrivacyUrl(): string {
  return webAppUrl('/privacy', process.env.EXPO_PUBLIC_API_URL, __DEV__);
}
