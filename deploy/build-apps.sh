#!/usr/bin/env bash
# Build all three HATPro apps for production (loads each app's .env.production and syncs
# the freshly-provisioned demo.json into the bundle). Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")/.."

for app in traveler-wallet supplier-console registry-explorer; do
  echo "── building $app ──"
  ( cd "apps/$app" && npm install --no-audit --no-fund && npm run build )
done
echo "✓ all apps built to apps/*/dist"
