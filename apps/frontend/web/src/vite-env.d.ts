/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_AUTH_APPLE_ENABLED?: string;
  readonly VITE_AUTH_GITHUB_ENABLED?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  // DEV-only. Shared secret for the in-app Dev Login (POST /auth/dev). Must
  // match the API's AUTH_DEV_ROUTE_SECRET. Unused in production builds.
  readonly VITE_DEV_AUTH_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
