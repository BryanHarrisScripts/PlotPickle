#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_SOURCE="${1:-$ROOT/out}"
OUTPUT="$ROOT/releases/local"

if [[ ! -f "$WEB_SOURCE/index.html" ]]; then
  echo "Static bundle is missing; building it now..."
  "$ROOT/scripts/build-local.sh"
fi

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

copy_runtime() {
  local source="${1:-}"
  local destination="$2"
  [[ -n "$source" && -d "$source" ]] || return 0
  cp -R "$source/." "$destination/"
}

package_platform() {
  local platform="$1"
  local launcher_source="$2"
  local launcher_name="$3"
  local runtime_source="$4"
  local package="$OUTPUT/PlotPickle-$platform"

  mkdir -p "$package/web" "$package/server" "$package/data/projects" "$package/data/backups" "$package/runtime/php"
  cp -R "$WEB_SOURCE/." "$package/web/"
  cp "$ROOT/local/server/router.php" "$package/server/router.php"
  cp "$launcher_source" "$package/$launcher_name"
  copy_runtime "$runtime_source" "$package/runtime/php"

  if [[ "$launcher_name" != *.bat ]]; then
    chmod +x "$package/$launcher_name"
  fi

  cat > "$package/README-FIRST.txt" <<EOF
PlotPickle Local — $platform

QUICK START
1. Extract the complete archive before starting PlotPickle.
2. Launch $launcher_name.
3. PlotPickle opens in your default browser at http://127.0.0.1:48721.
4. Leave the PlotPickle Local Server window open while you work.
5. Closing the server window safely stops PlotPickle.

YOUR FILES
Projects are stored in data/projects.
Automatic safety copies are stored in data/backups.
To update PlotPickle, copy the entire data folder into the fresh package before starting it.

PRIVACY
The server listens only on 127.0.0.1 and is not exposed to your network.
No Node.js, PHP, or developer software is required by the complete Windows package.
EOF

  if [[ ! -d "$package/runtime/php" || -z "$(find "$package/runtime/php" -mindepth 1 -print -quit)" ]]; then
    printf '\nDeveloper package: no bundled PHP runtime was supplied. Install PHP 8.1+ or set the matching PLOTPICKLE_*_PHP_DIR variable before packaging.\n' >> "$package/README-FIRST.txt"
  fi
}

package_platform "Windows" "$ROOT/local/launchers/windows/PlotPickle.bat" "START-PLOTPICKLE.bat" "${PLOTPICKLE_WINDOWS_PHP_DIR:-}"
package_platform "macOS" "$ROOT/local/launchers/macos/PlotPickle.command" "PlotPickle.command" "${PLOTPICKLE_MACOS_PHP_DIR:-}"
package_platform "Linux" "$ROOT/local/launchers/linux/plotpickle.sh" "plotpickle.sh" "${PLOTPICKLE_LINUX_PHP_DIR:-}"

(
  cd "$OUTPUT"
  command -v zip >/dev/null && zip -qr PlotPickle-Windows.zip PlotPickle-Windows
  command -v zip >/dev/null && zip -qr PlotPickle-macOS.zip PlotPickle-macOS
  tar -czf PlotPickle-Linux.tar.gz PlotPickle-Linux
)

cat > "$OUTPUT/manifest.json" <<EOF
{
  "version": "1.4.0",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "port": 48721,
  "packages": [
    "PlotPickle-Windows.zip",
    "PlotPickle-macOS.zip",
    "PlotPickle-Linux.tar.gz"
  ]
}
EOF

echo "Created PlotPickle Local packages in $OUTPUT"
