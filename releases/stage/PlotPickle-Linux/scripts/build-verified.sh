#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v node >/dev/null || {
  echo "build-verified.sh requires Node.js." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ "${OS:-}" == "Windows_NT" ]]; then
  vinext="${vinext}.cmd"
fi
if [[ ! -e "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

runner="${script_dir}/run-command-with-timeout.mjs"
if [[ ! -f "${runner}" ]]; then
  echo "The cross-platform build timeout runner is unavailable." >&2
  exit 69
fi

echo "Running bounded vinext build..."
node "${runner}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${SITES_BUILD_KILL_AFTER:-10s}" \
  -- "${vinext}" build

"${script_dir}/validate-artifact.sh"
