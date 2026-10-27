# OSS Radar — GitHub secondary rate-limit safety

## Incident, October 27, 2026

The daily `daily-discovery-report` workflow reached `Run OSS Radar` and
failed a GitHub repository search with HTTP 403 and GitHub's
`You have exceeded a secondary rate limit` message. Existing setup and
OSS Radar contract checks succeeded. The unavailable report is not evidence
that all candidate searches completed.

The current search client already recognizes 403/429 throttling, has a
per-search interval, and includes bounded retry settings. However,
`Number(null) === 0` made a missing `Retry-After` header equivalent to a
zero-second wait; the client could retry a known secondary-limit response
immediately. `Number(null)` has the same failure mode for the reset header.

## Repair

- Parse retry headers only if actually present and nonempty.
- A valid `Retry-After` value is authoritative; if the requested delay
  exceeds the bounded workflow wait budget, stop with the original failure,
  rather than retrying too early.
- Use `X-RateLimit-Reset` only when `X-RateLimit-Remaining: 0` establishes
  exhausted *primary* limit, not for a secondary 403 where requests remain.
- If no applicable header is present, use at least the one-minute fallback
  configured for the live Radar and increase successive bounded waits.
- Slow the adaptive repository-search minimum interval from 2250 to 3500 ms.
  The full adaptive contract spans 42 queries, so pacing matters; do not
  remove queries or claim results when searches were rejected.

## Test and acceptance

Focused regression in `tests/issue-2034-oss-radar-discovery-recall.test.mjs`
covers two secondary 403s without headers, an excessive
`Retry-After` that must not be shortened, and a secondary 403 with nonzero
primary allowance. Run the existing OSS Radar verification suite and
exact-head CI before merge. Daily live workflow recovery is separately
observed on a later GitHub Actions run; mocked retries are not evidence that
GitHub released the secondary limit.

No automatic re-run of the recently throttled live workflow, no token
rotation, no GitHub permission expansion, no code/model execution from third-
party projects, and no disabled errors or forged discovery results. Preserve
the existing schedule and update/report lifecycle.
