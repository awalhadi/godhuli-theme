#!/usr/bin/env bash
# Deploy Godhuli Shop to a target environment.
set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${LOG_FILE:-/tmp/godhuli-deploy.log}"
ENVIRONMENT="staging"
DRY_RUN=false
SERVICES=(api worker scheduler)
declare -A REPLICAS=([api]=3 [worker]=2 [scheduler]=1)

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG_FILE" >&2; }

cleanup() {
  local code=$?
  (( code != 0 )) && log "deploy failed with exit code ${code}"
  rm -rf "${TMP_DIR:-}"
}
trap cleanup EXIT
trap 'log "interrupted"; exit 130' INT TERM

usage() {
  cat <<EOF
Usage: $(basename "$0") [-e env] [-n] [-h]
  -e  target environment (staging|production), default: ${ENVIRONMENT}
  -n  dry run, print commands only
EOF
}

while getopts ":e:nh" opt; do
  case "$opt" in
    e) ENVIRONMENT="$OPTARG" ;;
    n) DRY_RUN=true ;;
    h) usage; exit 0 ;;
    \?) log "unknown option: -$OPTARG"; usage; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

case "$ENVIRONMENT" in
  staging|production) ;;
  *) log "invalid environment '${ENVIRONMENT}'"; exit 64 ;;
esac

run() {
  if [[ "$DRY_RUN" == true ]]; then echo "+ $*"; else "$@"; fi
}

TMP_DIR="$(mktemp -d)"
version="$(git -C "$SCRIPT_DIR" describe --tags --always 2>/dev/null || echo 'dev')"
log "Deploying v${version} to ${ENVIRONMENT} (${#SERVICES[@]} services)"

for svc in "${SERVICES[@]}"; do
  local_replicas="${REPLICAS[$svc]:-1}"
  [[ "$ENVIRONMENT" == "production" && "$svc" == "api" ]] && local_replicas=$((local_replicas * 2))
  run kubectl -n "godhuli-${ENVIRONMENT}" set image "deploy/${svc}" "${svc}=ghcr.io/godhuli/${svc}:${version}" 2>&1 \
    | grep -v '^Warning' >> "$LOG_FILE" || true
  run kubectl -n "godhuli-${ENVIRONMENT}" scale "deploy/${svc}" --replicas="$local_replicas"
done

attempt=0
until curl -fsS "https://${ENVIRONMENT}.godhuli.shop/healthz" > /dev/null; do
  (( ++attempt >= 10 )) && { log "health check timed out"; exit 1; }
  sleep $(( attempt * 2 ))
done

log "Deployment of ${version} complete ✔"
exit 0
