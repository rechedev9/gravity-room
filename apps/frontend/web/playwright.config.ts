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
    baseURL: 'http://localhost:3001',
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

  webServer: {
    command: 'bun run build:web && cd apps/backend/api && bun src/index.ts',
    url: 'http://localhost:3001',
    // build:web does vite build + prerender of 24 routes (~50s in CI),
    // then the API boots. Default 60s is too tight for CI runners.
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    cwd: resolve(__dirname, '../../..'),
    env: {
      AUTH_DEV_ROUTE_ENABLED: 'true',
    },
  },
});
