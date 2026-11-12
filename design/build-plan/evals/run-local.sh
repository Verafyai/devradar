#!/usr/bin/env bash
# Build a DevRadar ref on the box and run the mechanical eval against it. Read-only toward GitHub and the live site.
# Usage: ./run-local.sh <repo url, local path, or .bundle> <ref> [label]
# Starts the dev server on 127.0.0.1:43124 with all feature flags on (DEVRADAR_FLAGS=all; run with FLAGS= to test flags off), sample mode (no secrets set).
set -euo pipefail
SRC="${1:?repo}"; REF="${2:?ref}"; LABEL="${3:-$(date +%Y-%m-%d)-$(echo "$REF" | tr '/' '-')}"
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="/tmp/devradar-eval-$$"; PORT=43124
trap 'pkill -f "devradar-eval-$$" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
git clone -q "$SRC" "$WORK" && cd "$WORK" && git checkout -q "$REF"
SHA=$(git rev-parse --short HEAD)
npm ci --silent >/dev/null 2>&1 || npm install --silent >/dev/null 2>&1
env -i PATH="$PATH" HOME="$HOME" PORT=$PORT DEVRADAR_FLAGS="${FLAGS-all}" DEVRADAR_DATA_DIR="$WORK/.data" \
  nohup node "$WORK/dev-server.mjs" > "$WORK/server.log" 2>&1 &
for i in $(seq 1 30); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 1; done
TESTS=$( (timeout 300 npm test 2>&1 || true) | grep -E '^ℹ (pass|fail)' | tr '\n' ' ')
cd "$HERE" && node mech.mjs "http://127.0.0.1:$PORT" --out "$HERE/out/$LABEL" --shots | tail -2
echo "sha $SHA | tests: ${TESTS:-none found}" | tee "$HERE/out/$LABEL/build.txt"
