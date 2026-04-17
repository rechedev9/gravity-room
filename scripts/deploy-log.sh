#!/usr/bin/env bash
set -euo pipefail

# deploy-log.sh — Deploy log management for GZCLP Tracker
#
# Usage:
#   deploy-log.sh record <sha> [DEPLOY|ROLLBACK]  — append timestamped entry
#   deploy-log.sh list [count]                     — show last N entries (default 10, newest first)
#   deploy-log.sh rotate                           — trim log to last 50 entries

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${SCRIPT_DIR}/../.deploy.log"
readonly MAX_ENTRIES=50
readonly DEFAULT_LIST_COUNT=10

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [args]

Commands:
  record <sha> [DEPLOY|ROLLBACK]  Record a deploy/rollback entry
  list [count]                    Show last N entries (default ${DEFAULT_LIST_COUNT}, newest first)
  rotate                          Trim log to last ${MAX_ENTRIES} entries

Log file: ${LOG_FILE}
EOF
}

cmd_record() {
  local sha="${1:?Error: commit SHA is required}"
  local type="${2:-DEPLOY}"

  if [[ "${type}" != "DEPLOY" && "${type}" != "ROLLBACK" ]]; then
    echo "Error: type must be DEPLOY or ROLLBACK, got '${type}'" >&2
    exit 1
  fi

  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  # Create log file if it doesn't exist
  touch "${LOG_FILE}"

  echo "${timestamp} ${sha} ${type}" >> "${LOG_FILE}"
  echo "Recorded: ${timestamp} ${sha} ${type}"
}

cmd_list() {
  local count="${1:-${DEFAULT_LIST_COUNT}}"

  if [[ ! -f "${LOG_FILE}" ]]; then
    echo "No deploy history found."
    return 0
  fi

  local total
  total="$(wc -l < "${LOG_FILE}")"

  if [[ "${total}" -eq 0 ]]; then
    echo "No deploy history found."
    return 0
  fi

  echo "Last ${count} deploys (newest first):"
  echo "---"
  tail -n "${count}" "${LOG_FILE}" | tac
}

cmd_rotate() {
  if [[ ! -f "${LOG_FILE}" ]]; then
    echo "No log file to rotate."
    return 0
  fi

  local total
  total="$(wc -l < "${LOG_FILE}")"

  if [[ "${total}" -le "${MAX_ENTRIES}" ]]; then
    echo "Log has ${total} entries (limit: ${MAX_ENTRIES}). No rotation needed."
    return 0
  fi

  local tmp_file="${LOG_FILE}.tmp"
  tail -n "${MAX_ENTRIES}" "${LOG_FILE}" > "${tmp_file}"
  mv "${tmp_file}" "${LOG_FILE}"

  local trimmed=$((total - MAX_ENTRIES))
  echo "Rotated: removed ${trimmed} old entries, kept last ${MAX_ENTRIES}."
}

# --- Main ---

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

command="$1"
shift

case "${command}" in
  record)
    cmd_record "$@"
    ;;
  list)
    cmd_list "$@"
    ;;
  rotate)
    cmd_rotate "$@"
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "Error: unknown command '${command}'" >&2
    usage
    exit 1
    ;;
esac
