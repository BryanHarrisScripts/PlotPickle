#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export PLOTPICKLE_GITHUB_APP_CONFIG="${PLOTPICKLE_GITHUB_APP_CONFIG:-$PWD/config/github-app.json}"
export PLOTPICKLE_GOOGLE_OAUTH_CONFIG="${PLOTPICKLE_GOOGLE_OAUTH_CONFIG:-$PWD/config/google-oauth.json}"
PORT="${PLOTPICKLE_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"
RUNTIME_ENV="${TMPDIR:-/tmp}/plotpickle-runtime-$$.sh"

echo ""
echo "============================================================"
echo "  PlotPickle Playhouse - Linux Local Server"
echo "============================================================"
echo "PlotPickle runs only on this computer at 127.0.0.1."
echo "Keep this terminal open while writing. No cloud account is required."
echo ""

command -v node >/dev/null 2>&1 || { echo "Node.js 22.13 or newer is required: https://nodejs.org/"; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || { echo "Node.js 22.13 or newer is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm was not found."; exit 1; }

node scripts/portable-runtime.mjs prepare "$RUNTIME_ENV"
# shellcheck disable=SC1090
source "$RUNTIME_ENV"
rm -f "$RUNTIME_ENV"
export npm_config_cache="$PLOTPICKLE_NPM_CACHE"

if [ ! -x node_modules/.bin/vite ]; then
  echo "Installing the package-lock-specific reusable runtime..."
  npm ci --prefix "$PLOTPICKLE_RUNTIME_DIR" --include=dev --prefer-offline --no-audit --no-fund
  node scripts/portable-runtime.mjs mark-ready
else
  echo "Matching PlotPickle runtime reused."
fi

if command -v xdg-open >/dev/null 2>&1; then ( sleep 3; xdg-open "$URL" ) >/dev/null 2>&1 & fi
echo "Starting ${URL}"
echo "Press Control-C when finished."
exec node_modules/.bin/vite --host 127.0.0.1 --port "$PORT"
