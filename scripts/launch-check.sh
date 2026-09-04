#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm exec tsc --noEmit
pnpm lint

start=$(date +%s)
pnpm exec vitest run --reporter=dot
elapsed=$(( $(date +%s) - start ))
echo "vitest wall time: ${elapsed}s (budget 120s)"
if [ "$elapsed" -gt 120 ]; then
  echo "FAIL: the suite is over budget and has stopped being a gate." >&2
  exit 1
fi

pnpm build
