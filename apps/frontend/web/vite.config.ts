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
        // autoUpdate: new SW activates via skipWaiting on install. The in-page
        // SwUpdatePrompt still shows a reload banner so mid-workout users don't
        // lose in-flight tracker state — the new SW is ready, but the reload
        // only happens on user click.
        registerType: 'autoUpdate',
        // The manifest already lives in public/manifest.webmanifest and index.html
        // already has <link rel="manifest"> — let the plugin manage the SW only.
        manifest: false,
        devOptions: {
          // Keep SW disabled in dev to avoid caching headaches during development.
          enabled: false,
        },
        workbox: {
          // Precache built code/fonts/icons. WebPs are pulled out of the
          // precache to keep the SW install payload small — they hit the
          // CacheFirst rule below on first request instead.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          // For SPA: serve cached index.html for unrecognised navigation requests.
          // API calls are excluded so fetch errors surface normally. /presentacion
          // is a separate static deck served by Caddy (not an SPA route) — without
          // this denylist entry the SW hijacks its navigation and shows the SPA 404.
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/presentacion/],
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
            {
              urlPattern: /\.webp$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'webp-images',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 7 * 24 * 3600,
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
      },
    },
    build: {
      // Generate hidden source maps only when uploading to Sentry (SENTRY_AUTH_TOKEN set).
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
      outDir: 'dist',
      chunkSizeWarningLimit: 300,
      rolldownOptions: {
        // React Compiler intentionally runs through vite:react-babel; the full
        // web production build is still ~3-4s, so keep CI output focused on
        // actionable warnings instead of Rolldown's plugin timing hint.
        checks: { pluginTimings: false },
        output: {
          // Vite 8 uses Rolldown; use output.codeSplitting instead of the
          // deprecated Rollup-compatible manualChunks hook to avoid build-time
          // "Unknown input options: manualChunks" warnings.
          codeSplitting: {
            maxSize: 250 * 1024,
            groups: [
              {
                name(id: string): string | null {
                  if (!id.includes('node_modules')) return null;
                  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                    return 'vendor-react-core';
                  }
                  if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return 'vendor-tanstack';
                  // Match zod by path so both `zod` and subpaths like `zod/v4` land together.
                  if (/[\\/]node_modules[\\/]zod[\\/]/.test(id)) return 'vendor-zod';
                  if (
                    /[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion-dom)[\\/]/.test(
                      id
                    )
                  )
                    return 'vendor-motion';
                  if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return 'vendor-recharts';
                  if (/[\\/]node_modules[\\/]@sentry[\\/]/.test(id)) return 'vendor-sentry';
                  return null;
                },
              },
            ],
          },
          // Vite 8 / Rolldown ignores top-level esbuild.drop. The drop-console
          // / debugger flags ride along here via the oxc minifier options.
          minify:
            mode === 'production'
              ? { compress: { dropConsole: true, dropDebugger: true } }
              : undefined,
        },
      },
    },
    server: { port: 5173 },
  };
});
