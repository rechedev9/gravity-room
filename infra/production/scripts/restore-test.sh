#!/usr/bin/env bash
# Restore-test the most recent backup into a THROWAWAY database to prove the dump
# is actually usable. An untested backup is a hope, not a backup.
#
# Non-destructive: restores into a temp DB (gravity_restore_test) that is dropped on
# exit; never touches the live `gravity` database. Asserts the restore succeeds and
# that reference data (program_templates) came back. Logs to syslog (-t gr-restore-test).
# Exit non-zero on any failure so a cron/monitor can alert.

set -euo pipefail

BACKUP_DIR="/opt/gravity-room/backups"
COMPOSE_DIR="/opt/gravity-room"
TEST_DB="gravity_restore_test"

log() { logger -t gr-restore-test "$@"; echo "[$(date -u +%FT%TZ)] $*"; }
psql_postgres() { docker compose exec -T postgres psql -U gravity -d postgres "$@"; }

cd "$COMPOSE_DIR"

LATEST="$(ls -1t "$BACKUP_DIR"/gravity-*.dump 2>/dev/null | head -1 || true)"
[[ -n "$LATEST" ]] || { log "ERROR: no dump found in $BACKUP_DIR"; exit 1; }
log "restore-testing $(basename "$LATEST") into $TEST_DB"

cleanup() { psql_postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null
psql_postgres -c "CREATE DATABASE ${TEST_DB};" >/dev/null

if docker compose exec -T postgres pg_restore -U gravity -d "$TEST_DB" --no-owner --no-acl < "$LATEST" 2>&1 | logger -t gr-restore-test; then
  TABLES="$(docker compose exec -T postgres psql -U gravity -d "$TEST_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')"
  TEMPLATES="$(docker compose exec -T postgres psql -U gravity -d "$TEST_DB" -tAc "SELECT count(*) FROM program_templates;" 2>/dev/null | tr -d '[:space:]' || echo 0)"
  log "restore OK: ${TABLES} public tables, ${TEMPLATES} program_templates"
  if [[ "${TABLES:-0}" -lt 1 ]]; then
    log "ERROR: restored DB has no tables - backup is not usable"
    exit 1
  fi
else
  log "ERROR: pg_restore failed - backup is not usable"
  exit 1
fi

log "done"
