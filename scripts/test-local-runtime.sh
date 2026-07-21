#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PLOTPICKLE_TEST_PORT:-48722}"
PACKAGE="$ROOT/.tmp-local-smoke"

command -v php >/dev/null || {
  echo "PHP 8.1+ is required for the local runtime smoke test." >&2
  exit 69
}
command -v curl >/dev/null || {
  echo "curl is required for the local runtime smoke test." >&2
  exit 69
}

rm -rf "$PACKAGE"
mkdir -p "$PACKAGE/web" "$PACKAGE/server" "$PACKAGE/data/projects" "$PACKAGE/data/backups"
printf '<!doctype html><title>PlotPickle Local Test</title>' > "$PACKAGE/web/index.html"
cp "$ROOT/local/server/router.php" "$PACKAGE/server/router.php"

php -S "127.0.0.1:$PORT" -t "$PACKAGE/web" "$PACKAGE/server/router.php" > "$PACKAGE/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -rf "$PACKAGE"' EXIT

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$PORT/__plotpickle/health" >/dev/null; then
    break
  fi
  sleep 0.1
done

HEALTH="$(curl -fsS "http://127.0.0.1:$PORT/__plotpickle/health")"
grep -q '"localRuntime": true' <<<"$HEALTH"

PROJECT='{"schemaVersion":"1.1.0","id":"smoke-test","metadata":{"title":"Smoke Test"},"blocks":[]}'
curl -fsS -X PUT -H 'Content-Type: application/json' --data "$PROJECT" \
  "http://127.0.0.1:$PORT/__plotpickle/project?name=smoke-test.plotpickle.json" >/dev/null

SAVED="$(curl -fsS "http://127.0.0.1:$PORT/__plotpickle/project?name=smoke-test.plotpickle.json")"
grep -q '"id":"smoke-test"' <<<"$SAVED"

curl -fsS -X PUT -H 'Content-Type: application/json' --data "$PROJECT" \
  "http://127.0.0.1:$PORT/__plotpickle/project?name=smoke-test.plotpickle.json" >/dev/null

[[ -n "$(find "$PACKAGE/data/backups" -type f -name 'smoke-test.plotpickle-*.json' -print -quit)" ]]

echo "Local runtime health, save, load, and backup checks passed."
