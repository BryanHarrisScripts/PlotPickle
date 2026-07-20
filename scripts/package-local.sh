#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_SOURCE="${1:-$ROOT/out}"
OUTPUT="$ROOT/releases/local"

if [[ ! -f "$WEB_SOURCE/index.html" ]]; then
  echo "Static PlotPickle bundle not found at: $WEB_SOURCE" >&2
  echo "Pass the folder containing index.html as the first argument." >&2
  exit 66
fi

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

package_platform() {
  local platform="$1"
  local launcher_source="$2"
  local launcher_name="$3"
  local package="$OUTPUT/PlotPickle-$platform"

  mkdir -p "$package/web" "$package/server" "$package/data/projects" "$package/data/backups" "$package/runtime/php"
  cp -R "$WEB_SOURCE/." "$package/web/"
  cp "$ROOT/local/server/router.php" "$package/server/router.php"
  cp "$launcher_source" "$package/$launcher_name"

  if [[ "$launcher_name" != *.bat ]]; then
    chmod +x "$package/$launcher_name"
  fi

  cat > "$package/README.txt" <<EOF
PlotPickle Local — $platform

1. Launch $launcher_name.
2. PlotPickle opens in your default browser at http://127.0.0.1:48721.
3. Projects and backups stay inside the data folder.

For a public release, place the matching PHP runtime inside runtime/php before archiving this folder.
The launcher falls back to a system PHP installation when a bundled runtime is not present.
EOF
}

package_platform "Windows" "$ROOT/local/launchers/windows/PlotPickle.bat" "PlotPickle.bat"
package_platform "macOS" "$ROOT/local/launchers/macos/PlotPickle.command" "PlotPickle.command"
package_platform "Linux" "$ROOT/local/launchers/linux/plotpickle.sh" "plotpickle.sh"

echo "Created local packages in $OUTPUT"
