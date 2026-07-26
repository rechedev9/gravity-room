import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';
import { resolvePlaywrightEndpoints } from './playwright-ports';

const { apiPort, apiUrl, webPort, webUrl } = resolvePlaywrightEndpoints(process.env);

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: webUrl,
    locale: 'es-ES',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter api start',
      url: `${apiUrl}/api/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      cwd: resolve(__dirname, '../../..'),
      env: {
        PORT: apiPort,
        AUTH_DEV_ROUTE_ENABLED: 'true',
        AUTH_DEV_ROUTE_SECRET: 'e2e-dev-secret-not-for-prod',
        // The suite runs the web preview on a dedicated port; without this the browser's
        // API calls are CORS-blocked and every data-driven test fails.
        CORS_ORIGIN: webUrl,
        // Real GIS buttons require a client ID registered for localhost. Keep
        // Google disabled here and cover the enabled branch with the controlled
        // component in login-page-methods.test.tsx.
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_IDS: '',
      },
    },
    {
      command: `pnpm run build:web && pnpm --filter web exec vite preview --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webUrl,
      // build:web does vite build + prerender of 38 routes (~50s in CI),
      // then the preview server boots. Default 60s is too tight for CI runners.
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      cwd: resolve(__dirname, '../../..'),
      env: {
        VITE_API_URL: apiUrl,
        VITE_GOOGLE_CLIENT_ID: '',
      },
    },
  ],
});
