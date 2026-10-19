# #3150 — failure-stage receipts for the first Windows Factory pilot

The owner's first actual `#3141` pilot ran on native Windows at exact main `beb09cf106dc77ca46776e2d266d03ae57b66644`, with installed and Running Task Scheduler registration. A private reservation and final receipt were created; no PR was opened.

Observed durable original receipt:

- `jobs/issue-3141.json` was reserved
- `jobs/result-3141.json` reported `BLOCKED/SOURCE_OR_BUILD_OR_PROVIDER_FAILURE`
- one isolated worktree existed, `node_modules` existed, the approved `3141-autonomous-factory-native-acceptance.md` did not, and no contracts-only UAT artifact directory existed
- exact failed subprocess **UNKNOWN**: neither the presence of `node_modules` nor lack of a document proves npm install or Pi specifically failed
- the queue later truthfully reported `WAITING_FOR_ELIGIBLE_ISSUE` (one previously attempted approved issue, no automatic retry)

## Diagnostic increment

The coding adapter now attaches a **fixed, bounded phase enum** to its existing generic failure code. The queue persists this as a private `result-ISSUE.json.phase` alongside original `code`; it never stores stderr, model transcript, prompts, secrets, private paths or untrusted exception text. For post-push uncertainty, `PUSHED_UNCERTAIN` is preserved and never auto-replayed.

Phases are `INSTALL_DEPENDENCIES`, `RUN_LOCAL_PI`, `INSPECT_CANDIDATE_PATCH`, `CHECK_DIFF`, `RUN_CONTRACTS_UAT`, `RUN_PRODUCTION_BUILD`, `RECHECK_BASE_HEAD`, `STAGE_CANDIDATE`, `RECHECK_STAGED_PATHS`, `COMMIT_CANDIDATE`, `PUSH_CANDIDATE` and `CREATE_DRAFT_PR`. Unknown input maps to `UNKNOWN_STAGE`, not a guessed reason. Preflight stages outside this invocation must be investigated independently.

This PR does **not** interpret the first receipt retroactively: it remains an unclassified failure because stage-level evidence did not exist when the run occurred. The worktree and reservation must be preserved. A new attempt under a separately approved worktree/head/identity and preserved original ledger remains a future governed operation, not an allowed replay under this PR.

## Owner read-only evidence checks

These require no model invocation, npm installs or git mutation:

```powershell
$root = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\autonomous-queue'
$job = Get-Content (Join-Path $root 'jobs\issue-3141.json') -Raw | ConvertFrom-Json
$worktree = Join-Path $root ("worktrees\issue-{0}-{1}" -f $job.issueNumber, $job.sourceHead.Substring(0,10))
Test-Path (Join-Path $worktree 'node_modules\.package-lock.json')
Test-Path (Join-Path $worktree '.plotpickle-autonomous-issue.md')
Get-Item (Join-Path $worktree 'node_modules\.package-lock.json') -ErrorAction SilentlyContinue | Select-Object Length, LastWriteTime
git -C $worktree status --short
```

An npm lockfile presence strengthens the installation-completed hypothesis, but does not establish a successful Pi action. The Pi context file is removed in the agent's `finally` block on both success and failure; absence does not prove it never started.

Proof gates: synthetic fixtures for bounded stages and no secret leak, W8/W9 exact source-test digest bindings, BEN, independent seven-layer exact-head CI and actual Windows follow-up when a **new separately authorized attempt** is designed. The current #3141 original attempt remains BLOCKED and its outcome is not retroactively repaired.
