#!/usr/bin/env bash
# Compose smoke test (POSIX twin of smoke.ps1).
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up --build -d
cleanup() { docker compose down; }
trap cleanup EXIT

for _ in $(seq 1 45); do
  if curl -sf http://localhost:8088 >/dev/null; then up=1; break; fi
  sleep 2
done
[[ "${up:-}" == 1 ]] || { echo "app not responding at :8088" >&2; exit 1; }
echo "app up at http://localhost:8088"

(cd 04_source/frontend &&
  BASE_URL=http://localhost:8088 NO_WEB_SERVER=1 \
  npx playwright test e2e/home.spec.ts --project=chromium)

(cd tools/ui-test-agent && npm run test -- --base-url http://localhost:8088)

echo "SMOKE PASS"
