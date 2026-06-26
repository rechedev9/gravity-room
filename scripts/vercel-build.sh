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
#      on the same Vercel domain.
#
# Fail fast on any error, unset variable, or failed pipe stage.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "[vercel-build] VERCEL_ENV=production - running db:deploy (migrations + seeds) against DIRECT_DATABASE_URL"
  bun run --filter api db:deploy
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-local} - skipping production db:deploy (preview/local use a Neon branch)"
fi

echo "[vercel-build] building web SPA (same-origin: VITE_API_URL=\"\")"
VITE_API_URL="" bun run --filter web build
