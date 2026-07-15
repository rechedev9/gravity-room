#!/usr/bin/env bash
#
# Vercel build pipeline for the gravity-room same-origin project.
#
# Invoked by the "buildCommand" in vercel.json. Runs two phases:
#
#   1. PRODUCTION-ONLY database deploy. When VERCEL_ENV is "production" this applies
#      the Drizzle migrations and the idempotent reference-data seeds against
#      DIRECT_DATABASE_URL, exactly once per production deploy. It is skipped on
#      preview and local builds, which point at a throwaway Neon branch and must
#      never touch the production database. VERCEL_ENV is the only correct gate
#      here: Vercel sets NODE_ENV=production on preview builds too, so NODE_ENV
#      cannot distinguish preview from production.
#
#   2. Build the web SPA with Vite in same-origin mode. VITE_API_URL="" bakes in
#      relative "/api" requests so the static SPA talks to the catch-all function
#      (api/[...path].ts) on the same Vercel domain.
#
#      Vercel does not provide Chromium's Linux system libraries or apt-get, so
#      the prerender uses the serverless-compatible @sparticuz/chromium binary.
#      Local/CI builds retain Playwright's normal lockfile-pinned browser. The
#      deployed files therefore include the mounted route body and its
#      route-owned JSON-LD, not merely injected head tags.
#
# Fail fast on any error, unset variable, or failed pipe stage.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "[vercel-build] VERCEL_ENV=production - running db:deploy (migrations + seeds) against DIRECT_DATABASE_URL"
  pnpm --filter api db:deploy
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-local} - skipping production db:deploy (preview/local use a Neon branch)"
fi

echo "[vercel-build] bundling the API serverless function (self-contained ESM)"
node scripts/bundle-api-function.mjs

echo "[vercel-build] regenerating sitemap.xml (Chromium-free)"
pnpm --filter web sitemap

echo "[vercel-build] building web SPA (same-origin: VITE_API_URL=\"\")"
# Keep the explicit empty value in the environment for both `vite build` and
# the later `vite preview` process started by the prerender script.
export VITE_API_URL=""
pnpm --filter web build:no-prerender

if [ "${VERCEL:-}" = "1" ]; then
  echo "[vercel-build] using @sparticuz/chromium for the Vercel prerender"
else
  echo "[vercel-build] installing lockfile-pinned Playwright Chromium"
  pnpm --filter web exec playwright install chromium
fi

echo "[vercel-build] prerendering complete public routes with Chromium"
pnpm --filter web exec tsx scripts/prerender.ts
