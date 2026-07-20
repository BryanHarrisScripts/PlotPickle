#!/bin/zsh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PHP="$ROOT/runtime/php/php"
ROUTER="$ROOT/server/router.php"
HOST="127.0.0.1"
PORT="48721"
URL="http://$HOST:$PORT"

if [[ ! -x "$PHP" ]]; then
  PHP="$(command -v php || true)"
fi

if [[ -z "$PHP" ]]; then
  osascript -e 'display alert "PlotPickle could not find PHP" message "Reinstall the local package or install PHP 8.2 or newer."'
  exit 1
fi

open "$URL"
exec "$PHP" -S "$HOST:$PORT" "$ROUTER"
