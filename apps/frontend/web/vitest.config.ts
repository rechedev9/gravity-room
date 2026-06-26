import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vitest config for the web package (PN2 of the Bun -> pnpm migration).
// The React plugin gives JSX/TSX support to component tests; happy-dom supplies
// the DOM globals that bun's @happy-dom/global-registrator used to register.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // vite-plugin-pwa's virtual module isn't available under vitest; point it
      // at a no-op stub so components importing it resolve cleanly.
      'virtual:pwa-register/react': resolve(__dirname, 'test/stubs/pwa-register.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    // Only the in-source unit tests. The Playwright e2e suite (e2e/*.spec.ts)
    // is intentionally excluded so vitest never tries to run browser specs, and
    // codegen/generate-api-types.test.ts is excluded as it was under bun (it
    // asserts against a committed generated artifact and is run on demand).
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
});
