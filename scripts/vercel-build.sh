#!/usr/bin/env bash
#
# Vercel build pipeline for the Gravity Room same-origin project.
#
# The pipeline validates configuration and builds every deployable artifact
# before production DDL. Vercel has no post-build/pre-promotion hook, so the
# migration remains inside buildCommand; a platform upload/promotion failure
# after db:deploy can still leave an expanded schema ahead of the live app.
# Production migrations must therefore remain backward-compatible
# (expand/contract), and production promotion must be gated externally on CI.
#
# VERCEL_ENV is the production gate. Vercel also sets NODE_ENV=production on
# previews, so NODE_ENV cannot distinguish preview from production.
set -euo pipefail

IS_PRODUCTION=false
if [ "${VERCEL_ENV:-}" = "production" ]; then
  IS_PRODUCTION=true
  : "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL is required for production migrations}"

  echo "[vercel-build] validating production environment before build or DDL"
  pnpm exec tsx apps/backend/api/scripts/check-env.ts --node-env production
fi

echo "[vercel-build] validating Vercel rewrites and action-route headers"
pnpm run security:deployment

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

if [ "$IS_PRODUCTION" = true ]; then
  echo "[vercel-build] artifacts validated - applying serialized production migrations + seeds"
  pnpm --filter api db:deploy
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-local} - skipping production db:deploy"
fi
