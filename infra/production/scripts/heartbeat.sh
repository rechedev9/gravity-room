#!/usr/bin/env bash
# Pings Healthchecks.io every run iff Caddy + api are healthy.
# If /health fails, pings /fail variant so HC alerts immediately.
# Missed pings (VPS dead) get caught by HC grace timeout.
#
# ACTIVATION: this script is a silent no-op until the check URL is configured.
# Write the Healthchecks.io ping URL to /opt/gravity-room/.hc-url (mode 600,
# deploy-owned) to arm liveness alerting. See infra/production/OPERATIONS.md.

set -euo pipefail

URL_FILE="/opt/gravity-room/.hc-url"
[[ -r "$URL_FILE" ]] || exit 0  # silently no-op until URL is configured

HC_PING_URL="$(cat "$URL_FILE")"

# Probe via Caddy (loopback) → checks the full request path: TLS, Caddy, api, db, redis
if curl -fsS -m 8 "https://api.gravityroom.app/health" -o /dev/null; then
  curl -fsS -m 5 "${HC_PING_URL}" -o /dev/null || true
else
  curl -fsS -m 5 "${HC_PING_URL}/fail" -o /dev/null || true
  logger -t gr-heartbeat "FAIL: /health probe failed, notified HC"
fi
