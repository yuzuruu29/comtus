#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run --testTimeout=15000 --hookTimeout=15000
pnpm build
