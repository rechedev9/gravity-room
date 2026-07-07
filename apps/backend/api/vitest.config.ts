import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // Keep vitest output readable: the app logger writes JSON to stdout at
    // level "info" by default, which buries the reporter under request logs.
    // Tests that assert on log output build their own pino instance with an
    // explicit level (see src/lib/logger.test.ts), so silencing the global
    // default is safe.
    env: {
      LOG_LEVEL: 'silent',
    },
  },
});
