import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env / .env.[mode] files before the guard runs, so we don't
  // false-alarm when VITE_API_URL is defined in .env but not in process.env yet.
  const env = loadEnv(mode, process.cwd(), '');

  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL must be set for production builds — ' +
        'without it the API URL is baked in as http://localhost:3001'
    );
  }

  return {
    plugins: [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      VitePWA({
        registerType: 'prompt',
        // The manifest already lives in public/manifest.webmanifest and index.html
        // already has <link rel="manifest"> — let the plugin manage the SW only.
        manifest: false,
        devOptions: {
          // Keep SW disabled in dev to avoid caching headaches during development.
          enabled: false,
        },
        workbox: {
          // Precache all built assets (JS chunks, CSS, HTML, fonts, images).
          globPatterns: ['**/*.{js,css,html,webp,svg,ico,woff2}'],
          // For SPA: serve cached index.html for unrecognised navigation requests.
          // API calls are excluded so fetch errors surface normally.
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              // Auth endpoints: never cache — they set httpOnly cookies and must
              // always hit the network.
              urlPattern: /\/api\/auth\//,
              handler: 'NetworkOnly',
            },
            {
              // All other API calls: try network first, fall back to cache after
              // 5 s so the app remains usable in a gym with poor signal.
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 h
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
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
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@gzclp/shared': resolve(__dirname, 'src/lib/shared'),
      },
    },
    build: {
      // Generate hidden source maps only when uploading to Sentry (SENTRY_AUTH_TOKEN set).
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined;
            // React + TanStack (router + query) must share a chunk: otherwise Rollup's
            // chunk-merge heuristic fuses React into the main entry and emits an empty
            // vendor-react chunk.
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
              return 'vendor-react-core';
            if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return 'vendor-react-core';
            // Match zod by path so both `zod` and subpaths like `zod/v4` land together.
            if (/[\\/]node_modules[\\/]zod[\\/]/.test(id)) return 'vendor-zod';
            if (/[\\/]node_modules[\\/]motion[\\/]/.test(id)) return 'vendor-motion';
            if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return 'vendor-recharts';
            return undefined;
          },
        },
      },
    },
    server: { port: 5173 },
  };
});
