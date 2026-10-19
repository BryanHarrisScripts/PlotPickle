# #3150 — one governed new attempt for the failed #3141 Windows pilot

The owner ran the first unattended Windows factory #3141 attempt at exact main `beb09cf106dc77ca46776e2d266d03ae57b66644`. It produced `jobs/issue-3141.json` and `jobs/result-3141.json`, with the latter `BLOCKED/SOURCE_OR_BUILD_OR_PROVIDER_FAILURE`, no PR. The first isolated worktree remains clean, `node_modules/.package-lock.json` exists, and neither an approved document nor UAT artifacts were created. The exact failed step cannot be reconstructed because the original code did not record a bounded phase.

The first repair #3151 merged as `7104d52336488cf6d9cd7d93bdcaae7ce0043fe9` after seven independently green architecture layers. It adds bounded private stage codes on **future attempts**, not a retroactive diagnosis.

## Explicit separate second-attempt authorization

This slice adds **only** a governed second attempt for #3141. It is not a reset, a general retry button, an invitation to run the full backlog, or an automatic merge authorization.

The Windows owner must first stop the idle scheduled task (not remove factory consent), fast-forward the canonical checkout, inspect the original worktree, and explicitly authorize one new full-SHA head:

```powershell
cd C:\Users\bryan\plotpickle
Stop-ScheduledTask -TaskName PlotPickleSoftwareFactory
git switch main
git pull --ff-only
$head = (git rev-parse HEAD).Trim()
node scripts/engineering-team/windows/autonomous-queue.mjs --authorize-retry --issue 3141 --base $head --consent PLOTPICKLE_AUTONOMOUS_ENGINEERING
```

**Do not perform these actions until the new PR has passed independent CI and merged.** Confirm that the original task has stopped and do not issue the command from another worktree. The CLI refuses a live or unverifiable worker, an existing local STOP marker, any existing attempt-2 reservation, nonexact or unchanged heads, malformed original evidence, an uncertain/pushed original attempt, an unclean first worktree, a remote branch or PR for the first attempt, a mismatched allowed issue list, or existing auto-merge permission.

Approval writes a fresh immutable `jobs/retry-authorized-3141.json` with `attempt:2`, `sourceHead` and `priorHead`; it NEVER deletes or rewrites the original `jobs/issue-3141.json`, `jobs/result-3141.json`, first worktree or branch. On the next scheduler start, `runFactoryCycle` admits at most one new attempt against the exact authorized head and owner issue. The second run has its own `jobs/issue-3141-attempt-2.json`, `jobs/result-3141-attempt-2.json`, `worktrees/issue-3141-<newHead10>-a2`, and `factory/issue-3141-<newHead10>-a2` branch. It never reuses an uncertain attempt. After authorizing, restart only the already-owned scheduled task:

```powershell
Start-ScheduledTask -TaskName PlotPickleSoftwareFactory
node scripts/engineering-team/windows/autonomous-queue.mjs --status
```

**Caution:** Stop-ScheduledTask must not be used while the coding agent is still RUNNING. This procedure is specific to the already terminal `BLOCKED` #3141 attempt. If the task cannot be shown stopped, or any command reports BLOCKED, do not manually delete locks, worktrees, consent files or job records. Request an owner audit.

## Truth and proof limits

Both attempts remain local Pi only, no authorized cloud spending, no automatic merge, no Windows Product Gate PASS and no new GitHub issue permissions. The writer for #3141 may still change only `docs/developer-briefs/3141-autonomous-factory-native-acceptance.md`. A source-bound patch, actual contracts-only UAT, production build, draft PR, independent current-head seven-layer CI and separately governed merge are required before marking #3141 complete. A second failure remains BLOCKED and cannot be automatically replayed. This feature's fixture tests and GitHub CI do **not** substitute for the owner's future Windows proof.

The general newest-first backlog authorization remains a distinct issue #3148 with dependency and scope checks; do not use this narrow #3141 retry to enable all issues.
