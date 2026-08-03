#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPOSITORY:-}"
apply=false
make_public=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --apply) apply=true; shift ;;
    --make-public) make_public=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "GitHub CLI is required." >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required." >&2; exit 1; }
gh auth status >/dev/null

if [[ -z "$repo" ]]; then repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"; fi
[[ "$repo" == */* ]] || { echo "Use --repo owner/name." >&2; exit 1; }

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config="$root/config/public-repository.settings.json"
[[ -f "$config" ]] || { echo "Missing $config" >&2; exit 1; }

api_json() {
  local method="$1" endpoint="$2" body="${3:-}"
  if [[ "$apply" != true ]]; then echo "DRY RUN  $method /$endpoint"; return; fi
  if [[ -n "$body" ]]; then printf '%s' "$body" | gh api --method "$method" "$endpoint" --input - >/dev/null
  else gh api --method "$method" "$endpoint" >/dev/null
  fi
  echo "APPLIED  $method /$endpoint"
}

repository_body="$(jq -c --arg visibility "$([[ "$make_public" == true ]] && echo public || echo '')" '
  .repository
  | del(.visibility)
  | .description = "Local-first visual story development, screenplay structure, collaboration, and Graphic Novel creation."
  | if $visibility == "public" then .visibility = "public" else . end
' "$config")"
api_json PATCH "repos/$repo" "$repository_body"
api_json PUT "repos/$repo/vulnerability-alerts" || true
api_json PUT "repos/$repo/automated-security-fixes" || true
api_json PUT "repos/$repo/private-vulnerability-reporting" || true
api_json PATCH "repos/$repo" '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' || true

protection_body="$(jq -c '
  .main_branch as $m
  | {
      required_status_checks: {strict: true, contexts: $m.required_checks},
      enforce_admins: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: $m.dismiss_stale_reviews,
        require_code_owner_reviews: $m.require_code_owner_review,
        required_approving_review_count: $m.required_approvals,
        require_last_push_approval: false
      },
      restrictions: null,
      required_linear_history: $m.require_linear_history,
      allow_force_pushes: ($m.block_force_pushes | not),
      allow_deletions: ($m.block_deletions | not),
      block_creations: false,
      required_conversation_resolution: $m.require_conversation_resolution,
      lock_branch: false,
      allow_fork_syncing: true
    }
' "$config")"
api_json PUT "repos/$repo/branches/main/protection" "$protection_body"
api_json PUT "repos/$repo/topics" '{"names":["plotpickle","screenwriting","story-development","graphic-novel","local-first","open-source"]}' || true

if [[ "$apply" == true ]]; then
  echo "PlotPickle repository configuration finished."
  [[ "$make_public" == true ]] || echo "Visibility remains unchanged. Review docs/PUBLIC_RELEASE_CHECKLIST.md, then rerun with --apply --make-public."
else
  echo "Dry run complete. Rerun with --apply after review."
fi
