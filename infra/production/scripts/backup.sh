#!/usr/bin/env bash
# Daily Postgres logical backup via pg_dump inside the postgres:18-alpine container.
# Writes custom-format dump to /opt/gravity-room/backups (on the VPS root disk,
# physically separate from /mnt/pg-vol where Postgres data lives). 7-day local retention.
# Logs to syslog (view via: journalctl -t gr-backup --since today).
#
# Optional OFFSITE copy: if /opt/gravity-room/.backup-env defines RCLONE_REMOTE and
# rclone is installed, each fresh dump is also pushed offsite (best-effort - a failed
# upload never aborts or invalidates the local dump, which remains the floor). The
# remote SHOULD be an rclone `crypt` remote so the dump (which contains the users
# table: email + google_id) is encrypted client-side before it leaves the box.
# See infra/production/OPERATIONS.md for the one-time offsite setup.

set -euo pipefail

BACKUP_DIR="/opt/gravity-room/backups"
RETENTION_DAYS=7
COMPOSE_DIR="/opt/gravity-room"
ENV_FILE="/opt/gravity-room/.backup-env"

log() { logger -t gr-backup "$@"; echo "[$(date -u +%FT%TZ)] $*"; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DATE=$(date -u +%FT%H%M%SZ)
TMP="$BACKUP_DIR/gravity-${DATE}.dump.tmp"
FINAL="$BACKUP_DIR/gravity-${DATE}.dump"

log "starting pg_dump to ${FINAL}"
cd "$COMPOSE_DIR"
if docker compose exec -T postgres \
     pg_dump -U gravity -d gravity --format=custom --no-owner --no-acl --no-comments \
     > "$TMP"; then
  mv "$TMP" "$FINAL"
  SIZE=$(stat -c%s "$FINAL")
  log "wrote ${FINAL} (${SIZE} bytes)"
else
  rm -f "$TMP"
  log "ERROR: pg_dump failed"
  exit 1
fi

# --- offsite copy (best-effort; the local dump above is the floor) ---
# shellcheck disable=SC1090
[[ -r "$ENV_FILE" ]] && source "$ENV_FILE"
if [[ -n "${RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null 2>&1; then
  REMOTE_PATH="${RCLONE_REMOTE%/}/$(date -u +%Y/%m)/$(basename "$FINAL")"
  if rclone copyto --no-traverse "$FINAL" "$REMOTE_PATH" 2>&1 | logger -t gr-backup; then
    log "offsite upload ok -> ${REMOTE_PATH}"
  else
    log "WARN: offsite upload failed (local dump retained)"
  fi
else
  log "offsite upload skipped (set RCLONE_REMOTE in ${ENV_FILE} + install rclone to enable)"
fi

log "pruning local backups older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -maxdepth 1 -name 'gravity-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete | while read -r f; do
  log "deleted old backup: $f"
done

log "done"
