#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ROOT="${1:-$ROOT/vendor/php-runtimes}"
DEST_ROOT="$ROOT/runtime-staging"

rm -rf "$DEST_ROOT"
mkdir -p "$DEST_ROOT/windows" "$DEST_ROOT/macos" "$DEST_ROOT/linux"

stage_runtime() {
  local platform="$1"
  local executable="$2"
  local source="$SOURCE_ROOT/$platform"
  local destination="$DEST_ROOT/$platform"

  if [[ ! -d "$source" ]]; then
    echo "Missing $platform PHP runtime: $source" >&2
    return 1
  fi
  if [[ ! -f "$source/$executable" ]]; then
    echo "Missing $platform PHP executable: $source/$executable" >&2
    return 1
  fi

  cp -R "$source/." "$destination/"
  if [[ "$platform" != "windows" ]]; then
    chmod +x "$destination/$executable"
  fi
  "$destination/$executable" -r 'echo PHP_VERSION, PHP_EOL;'
}

stage_runtime windows php.exe
stage_runtime macos php
stage_runtime linux php

echo "Validated PHP runtimes in $DEST_ROOT"
