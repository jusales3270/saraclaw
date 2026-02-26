#!/usr/bin/env bash
set -euo pipefail

cd /repo

export SARACLAW_STATE_DIR="/tmp/openclaw-test"
export SARACLAW_CONFIG_PATH="${SARACLAW_STATE_DIR}/openclaw.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${SARACLAW_STATE_DIR}/credentials"
mkdir -p "${SARACLAW_STATE_DIR}/agents/main/sessions"
echo '{}' >"${SARACLAW_CONFIG_PATH}"
echo 'creds' >"${SARACLAW_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${SARACLAW_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm openclaw reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${SARACLAW_CONFIG_PATH}"
test ! -d "${SARACLAW_STATE_DIR}/credentials"
test ! -d "${SARACLAW_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${SARACLAW_STATE_DIR}/credentials"
echo '{}' >"${SARACLAW_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm openclaw uninstall --state --yes --non-interactive

test ! -d "${SARACLAW_STATE_DIR}"

echo "OK"
