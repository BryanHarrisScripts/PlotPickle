#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${PLOTPICKLE_PHP_VERSION:-8.5.8}"
EXPECTED_SHA256="${PLOTPICKLE_PHP_SHA256:-63a3f6493f37c9ff3e288ec16621222a6cda5167dd1abffec0019e7f18c8e7e9}"
ARCHIVE="php-${VERSION}-nts-Win32-vs17-x64.zip"
URL="https://downloads.php.net/~windows/releases/archives/${ARCHIVE}"
DESTINATION="$ROOT/vendor/php-runtimes/windows"
CACHE="$ROOT/.cache/php/$ARCHIVE"

command -v curl >/dev/null || { echo "curl is required." >&2; exit 69; }
command -v unzip >/dev/null || { echo "unzip is required." >&2; exit 69; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 69; }

mkdir -p "$(dirname "$CACHE")" "$DESTINATION"

if [[ ! -f "$CACHE" ]]; then
  echo "Downloading official PHP ${VERSION} Windows x64 NTS runtime..."
  curl --fail --location --retry 3 --output "$CACHE" "$URL"
fi

echo "${EXPECTED_SHA256}  ${CACHE}" | sha256sum --check --status || {
  echo "PHP runtime checksum verification failed." >&2
  rm -f "$CACHE"
  exit 65
}

rm -rf "$DESTINATION"
mkdir -p "$DESTINATION"
unzip -q "$CACHE" -d "$DESTINATION"

[[ -f "$DESTINATION/php.exe" ]] || {
  echo "The downloaded archive did not contain php.exe." >&2
  exit 66
}

cat > "$DESTINATION/PLOTPICKLE-RUNTIME.txt" <<EOF
PlotPickle bundled PHP runtime
Version: ${VERSION}
Build: Windows x64 Non Thread Safe, VS17
Source: ${URL}
SHA-256: ${EXPECTED_SHA256}

PHP is distributed under the PHP License included in this runtime directory.
EOF

echo "Staged verified Windows PHP runtime at $DESTINATION"
