import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

if (process.env.NODE_ENV === 'production' && !process.env.VITE_API_URL) {
  throw new Error(
    'VITE_API_URL must be set for production builds — ' +
      'without it the API URL is baked in as http://localhost:3001'
  );
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    // Sentry plugin must be last. Only runs when SENTRY_AUTH_TOKEN is set (production CI).
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.SENTRY_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
          }),
        ]
      : []),
  ],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    // Generate hidden source maps only when uploading to Sentry (SENTRY_AUTH_TOKEN set).
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-zod': ['zod'],
        },
      },
    },
  },
  server: { port: 5173 },
});
