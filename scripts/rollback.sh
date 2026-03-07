#!/usr/bin/env bash
set -euo pipefail

# rollback.sh — VPS rollback script for GZCLP Tracker
#
# Usage:
#   rollback.sh <target-sha>          Interactive rollback to a specific commit
#   rollback.sh                       Rollback to the previous deploy
#   rollback.sh --force <target-sha>  Force rollback (skip confirmation prompts)
#   rollback.sh --list                Show deploy history
#   rollback.sh --help                Show usage information
#
# Exit codes:
#   0 = rollback succeeded, health checks passed
#   1 = rollback failed (image pull, health check, etc.)
#   2 = target SHA not found in deploy log
#   3 = user cancelled at migration boundary prompt

# --- Configuration ---

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly DEPLOY_LOG_SCRIPT="${SCRIPT_DIR}/deploy-log.sh"
readonly GHCR_REPO="ghcr.io/rechedev9/gravity-room"
readonly DRIZZLE_DIR="${PROJECT_DIR}/apps/api/drizzle"
readonly HEALTH_CHECK_RETRIES=5
readonly HEALTH_CHECK_DELAY=5
readonly API_HEALTH_URL="http://127.0.0.1:3002/health"
readonly WEB_HEALTH_URL="http://127.0.0.1:8080"

# --- Functions ---

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] [COMMIT_SHA]

Roll back the VPS to a previous deploy using pre-built GHCR images.

Arguments:
  COMMIT_SHA    Target commit SHA to roll back to (default: previous deploy)

Options:
  --force       Skip confirmation prompts
  --list        Show deploy history and exit
  --help, -h    Show this help message and exit

Exit codes:
  0  Rollback succeeded, health checks passed
  1  Rollback failed (image pull failed, health check failed, etc.)
  2  Target SHA not found in deploy log
  3  User cancelled at migration boundary prompt

Examples:
  $(basename "$0")                  # Roll back to previous deploy
  $(basename "$0") abc1234          # Roll back to specific commit
  $(basename "$0") --force abc1234  # Force rollback, skip prompts
  $(basename "$0") --list           # Show deploy history
EOF
}

step() {
  echo ""
  echo "==> $1"
}

warn() {
  echo "WARNING: $1" >&2
}

error() {
  echo "ERROR: $1" >&2
}

get_deploy_log_entries() {
  if [[ ! -x "${DEPLOY_LOG_SCRIPT}" ]]; then
    error "deploy-log.sh not found or not executable at ${DEPLOY_LOG_SCRIPT}"
    exit 1
  fi
  "${DEPLOY_LOG_SCRIPT}" list 50 2>/dev/null || true
}

get_previous_sha() {
  if [[ ! -f /var/log/gzclp-deploy.log ]]; then
    error "No deploy history found. Cannot determine previous deploy."
    exit 2
  fi

  local total
  total="$(wc -l < /var/log/gzclp-deploy.log)"

  if [[ "${total}" -lt 2 ]]; then
    error "Not enough deploy history to determine previous deploy (need at least 2 entries)."
    exit 2
  fi

  # Second-to-last line contains the previous deploy
  local prev_line
  prev_line="$(tail -n 2 /var/log/gzclp-deploy.log | head -n 1)"

  # Format: TIMESTAMP SHA TYPE — extract SHA (second field)
  echo "${prev_line}" | awk '{print $2}'
}

sha_exists_in_log() {
  local target_sha="$1"

  if [[ ! -f /var/log/gzclp-deploy.log ]]; then
    return 1
  fi

  grep -q "^[^ ]* ${target_sha} " /var/log/gzclp-deploy.log
}

count_migrations() {
  local dir="$1"
  if [[ -d "${dir}" ]]; then
    find "${dir}" -maxdepth 1 -name "*.sql" -type f | wc -l
  else
    echo 0
  fi
}

check_migration_boundary() {
  local target_sha="$1"
  local force="$2"

  step "Checking migration boundary..."

  local current_migrations
  current_migrations="$(count_migrations "${DRIZZLE_DIR}")"

  # Check out the target SHA's drizzle directory to count its migrations
  local target_migrations
  target_migrations="$(git -C "${PROJECT_DIR}" show "${target_sha}:apps/api/drizzle" 2>/dev/null \
    | grep -c '\.sql$' || echo 0)"

  echo "  Current migrations: ${current_migrations}"
  echo "  Target migrations:  ${target_migrations}"

  if [[ "${target_migrations}" -lt "${current_migrations}" ]]; then
    warn "Target commit has ${target_migrations} migrations vs current ${current_migrations}."
    warn "Rolling back may require manual DB intervention."
    echo ""

    if [[ "${force}" == "true" ]]; then
      echo "  --force flag set, proceeding without confirmation."
      return 0
    fi

    read -r -p "  Continue with rollback? [y/N] " response
    case "${response}" in
      [yY][eE][sS]|[yY])
        echo "  Proceeding with rollback."
        return 0
        ;;
      *)
        echo "  Rollback cancelled by user."
        exit 3
        ;;
    esac
  else
    echo "  No migration boundary crossed."
  fi
}

ghcr_login() {
  if [[ -z "${GHCR_TOKEN:-}" ]]; then
    step "No GHCR_TOKEN set, pulling from public registry..."
    return 0
  fi

  step "Authenticating to GHCR..."

  if ! echo "${GHCR_TOKEN}" | docker login ghcr.io -u rechedev9 --password-stdin 2>/dev/null; then
    error "Failed to authenticate to GHCR."
    exit 1
  fi

  echo "  Authenticated to GHCR."
}

pull_images() {
  local target_sha="$1"

  step "Pulling images from GHCR..."

  export GHCR_API_IMAGE="${GHCR_REPO}/api:${target_sha}"
  export GHCR_WEB_IMAGE="${GHCR_REPO}/web:${target_sha}"

  echo "  API image: ${GHCR_API_IMAGE}"
  echo "  Web image: ${GHCR_WEB_IMAGE}"

  if ! docker compose -f "${PROJECT_DIR}/docker-compose.yml" pull api web; then
    error "Failed to pull images from GHCR. Current containers are unchanged."
    exit 1
  fi

  echo "  Images pulled successfully."
}

restart_containers() {
  step "Restarting containers..."

  if ! docker compose -f "${PROJECT_DIR}/docker-compose.yml" up -d --remove-orphans; then
    error "Failed to restart containers."
    exit 1
  fi

  echo "  Containers restarted."
}

run_health_checks() {
  step "Running health checks (${HEALTH_CHECK_RETRIES} retries, ${HEALTH_CHECK_DELAY}s delay)..."

  local api_ok=false
  local web_ok=false

  for i in $(seq 1 "${HEALTH_CHECK_RETRIES}"); do
    echo "  Attempt ${i}/${HEALTH_CHECK_RETRIES}..."

    if [[ "${api_ok}" == "false" ]]; then
      if curl -sf "${API_HEALTH_URL}" > /dev/null 2>&1; then
        echo "  API health check passed."
        api_ok=true
      fi
    fi

    if [[ "${web_ok}" == "false" ]]; then
      if curl -sf "${WEB_HEALTH_URL}" > /dev/null 2>&1; then
        echo "  Web health check passed."
        web_ok=true
      fi
    fi

    if [[ "${api_ok}" == "true" && "${web_ok}" == "true" ]]; then
      break
    fi

    if [[ "${i}" -lt "${HEALTH_CHECK_RETRIES}" ]]; then
      sleep "${HEALTH_CHECK_DELAY}"
    fi
  done

  if [[ "${api_ok}" == "false" ]]; then
    error "API health check FAILED after ${HEALTH_CHECK_RETRIES} attempts."
    echo ""
    echo "Last 50 lines of API container logs:"
    docker compose -f "${PROJECT_DIR}/docker-compose.yml" logs --tail=50 api 2>/dev/null || true
    exit 1
  fi

  if [[ "${web_ok}" == "false" ]]; then
    error "Web health check FAILED after ${HEALTH_CHECK_RETRIES} attempts."
    echo ""
    echo "Last 50 lines of web container logs:"
    docker compose -f "${PROJECT_DIR}/docker-compose.yml" logs --tail=50 web 2>/dev/null || true
    exit 1
  fi

  echo "  All health checks passed."
}

record_rollback() {
  local target_sha="$1"

  step "Recording rollback in deploy log..."
  "${DEPLOY_LOG_SCRIPT}" record "${target_sha}" ROLLBACK
}

# --- Main ---

force=false
target_sha=""
show_list=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --force)
      force=true
      shift
      ;;
    --list)
      show_list=true
      shift
      ;;
    -*)
      error "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      target_sha="$1"
      shift
      ;;
  esac
done

# Handle --list
if [[ "${show_list}" == "true" ]]; then
  get_deploy_log_entries
  exit 0
fi

# Determine target SHA
if [[ -z "${target_sha}" ]]; then
  step "No target SHA provided. Finding previous deploy..."
  target_sha="$(get_previous_sha)"
  echo "  Previous deploy: ${target_sha}"
fi

echo "====================================="
echo "GZCLP Tracker — Rollback"
echo "Target: ${target_sha}"
echo "====================================="

# Verify target SHA exists in deploy log
step "Checking deploy history..."
if ! sha_exists_in_log "${target_sha}"; then
  error "Commit ${target_sha} not found in deploy history."
  echo ""
  echo "Available deploys:"
  get_deploy_log_entries
  exit 2
fi
echo "  Found ${target_sha} in deploy history."

# Check migration boundary
check_migration_boundary "${target_sha}" "${force}"

# Authenticate to GHCR
ghcr_login

# Pull images
pull_images "${target_sha}"

# Restart containers
restart_containers

# Health checks
run_health_checks

# Record rollback
record_rollback "${target_sha}"

# Done
echo ""
echo "====================================="
echo "Rollback to ${target_sha} COMPLETE"
echo "====================================="
exit 0
