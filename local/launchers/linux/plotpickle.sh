#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PHP="$ROOT/runtime/php/php"
ROUTER="$ROOT/server/router.php"
HOST="127.0.0.1"
PORT="48721"
URL="http://$HOST:$PORT"

if [[ ! -x "$PHP" ]]; then
  PHP="$(command -v php || true)"
fi

if [[ -z "$PHP" ]]; then
  echo "PlotPickle could not find PHP. Reinstall the local package or install PHP 8.2 or newer." >&2
  exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi

exec "$PHP" -S "$HOST:$PORT" "$ROUTER"
