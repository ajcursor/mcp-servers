#!/usr/bin/env bash
# Cloud agent setup: install dependencies and fetch the Xytech sandbox (mediapulse-sim) that the
# sandbox tests run against. Sandbox tests skip cleanly if the sim can't be fetched.
set -euo pipefail

npm ci --no-audit --no-fund || npm install --no-audit --no-fund

SIM="${MEDIAPULSE_SIM_DIR:-.sandbox/mediapulse-sim}"
if [[ -d ../mediapulse-sim && -z "${MEDIAPULSE_SIM_DIR:-}" ]]; then SIM=../mediapulse-sim; fi
if [[ ! -f "$SIM/package.json" ]]; then
  owner="$(git remote get-url origin 2>/dev/null | sed -E 's#^.*[:/]([^/]+)/[^/]+$#\1#')"
  mkdir -p "$(dirname "$SIM")"
  if ! git clone --depth 1 "https://github.com/${owner:-dazn-ops}/mediapulse-sim.git" "$SIM" 2>/dev/null; then
    echo "mediapulse-sim is not reachable from here; sandbox tests will be skipped."
    exit 0
  fi
fi
(cd "$SIM" && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund))
echo "Xytech sandbox ready at $SIM (npm run sandbox → http://127.0.0.1:4902, token sandbox-token)"
