import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:5173',
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
      command: 'cd apps/backend/api && bun src/dev-server.ts',
      url: 'http://localhost:3001/api/health',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      cwd: resolve(__dirname, '../../..'),
      env: {
        AUTH_DEV_ROUTE_ENABLED: 'true',
        AUTH_DEV_ROUTE_SECRET: 'e2e-dev-secret-not-for-prod',
      },
    },
    {
      command: 'bun run build:web && bun run --filter web preview',
      url: 'http://localhost:5173',
      // build:web does vite build + prerender of 24 routes (~50s in CI),
      // then the preview server boots. Default 60s is too tight for CI runners.
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      cwd: resolve(__dirname, '../../..'),
      env: {
        VITE_API_URL: 'http://localhost:3001',
      },
    },
  ],
});
