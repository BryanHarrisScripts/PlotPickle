#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXT="$ROOT/node_modules/.bin/next"

if [[ ! -x "$NEXT" ]]; then
  echo "Next.js is unavailable. Run npm ci first." >&2
  exit 69
fi

rm -rf "$ROOT/out"

echo "Building PlotPickle Local static export..."
PLOTPICKLE_LOCAL_EXPORT=1 "$NEXT" build

[[ -f "$ROOT/out/index.html" ]] || {
  echo "Local export did not create out/index.html." >&2
  exit 66
}

if ! grep -R -q "__plotpickle/health" "$ROOT/out"; then
  echo "Local runtime bridge is missing from the exported JavaScript." >&2
  exit 65
fi

if ! grep -R -q "plotpickle.project.v1" "$ROOT/out"; then
  echo "Canonical project storage key is missing from the export." >&2
  exit 65
fi

echo "Validated PlotPickle Local export in out/."
