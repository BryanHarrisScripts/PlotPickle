# #3098 — Engineering Team: explicit on-demand local adapters (first slice)

Parent: #3096. This is a bounded deliverable from #3098, not closure of the
full durable multi-agent task graph.

## Governance

Only the existing PlotPickle managed Pi CLI (without auto-install), its
approved local model route, and the existing focused deterministic UAT
contracts are supported. No new orchestration system, service, cloud fallback,
automatic provider dispatch, public BUZZ, GitHub writes, canon mutation or merge
authority. The original exact-head and independent-source-truth contracts from
#3097 remain higher authority than agent opinions.

The operator explicitly selects the target exact head and exact base SHA.
The CLI refuses dirty tracked source, wrong HEAD, non-ancestor base,
unrecognized role/mode and duplicate attempt. The complete ancestry range is
used for changed-file reviewer hints; a last-commit-only diff is not a PR proxy.
After every callback the runner re-reads the exact checkout commit.
--run is always required. It will not execute during startup/status.

## Role bindings

- Scout: managed Pi read-only code inspection of the frozen checkout, with
  read/grep/find/ls only, no shell or source writes.
- Tester: real focused UAT contracts subprocess (run-uat-autopilot.mjs
  --contracts-only) and a fresh JSON receipt consistent with subprocess exit.
- Challenger: separate no-session managed Pi read-only call; its own result
  remains advisory even when the summary agrees with the scout.
- Any missing local Pi or approved model leaves a truthful BLOCKED role, not
  a fabricated model result. These roles do not prove independent models, but
  they use separate read-only invocations.
- Performance, Reporter, Maintainer, repair workflow and automated GitHub/BUZZ
  coordination remain unbound in this slice, for later packages #3098–#3100.

UAT PASS is a contracts-only result, not a reproduced product defect.
Agent text cannot promote a candidate to VERIFIED. A separate third
deterministic verifier/independent adjudicator is still needed. Partial/blocked
runs keep that truth visible in the receipt.

## On-demand local command

From a clean, isolated PlotPickle checkout (Windows PowerShell) with the
managed Pi and a supported local coding model already configured:

    $head = git rev-parse HEAD
    $base = git merge-base origin/main HEAD
    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3098 --mode structured

To compare summary exchange without sharing receipt refs:

    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3098 --mode lossy

Results are written exclusively to a private run folder under
LOCALAPPDATA/PlotPickle/engineering-team/runs/ (or an OS-specific local
app root). A matching scope hash reserves exactly one attempt. To repeat
intentionally, increment --attempt N. A crashed attempt does not silently
replay AI calls: Pi Durable-backed recovery is a future package.

## Evidence and limits

- Unit tests and source/contract CI prove parsing, exact-head/base admission,
  fail-closed process receipts, advisory outputs, synthetic role independence,
  duplicate attempts, stale-head interruption and local-result storage.
- Product evidence requires a real Windows machine with the approved managed
  Pi CLI, a provider response, focused UAT execution and durable recovery.
- No external BUZZ message or GitHub issue/comment is attempted.
- The private local UAT evidence itself is not part of a public PR comment.
- Code authors cannot self-award a truth PASS or merge authority.

## Release

This change must pass the current approved-truth binding gate, node focused
tests, convergence map, Architecture Verification on exact PR head and relevant
production build checks. Squash-merge only on independently green required
checks. Keep #3098 OPEN for live checkpoint/restart, alternate Cline
independent executor and broader real orchestration evidence.
