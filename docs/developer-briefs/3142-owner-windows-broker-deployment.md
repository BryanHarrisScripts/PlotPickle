# #3142 — Owner-Windows Acceptance Broker deployment and pilot

Date: 2026-10-26. Parent: PR #3311 (draft), #3314 (stacked draft), issue #3302 (independent verification) and roadmap #3274. Governing references: AGENTS.md, README.md and the #3142 owner-Windows live acceptance gate.

**This is an owner-controlled pre-merge pilot, not an unattended Factory activation.** The Independent Windows Supervisor (PlotPickleIndependentSupervisor) stays installed and running separately. Do not stop it, recreate its scheduled task, run legacy Pi, bypass a denied ChatGPT MCP control action, or treat a tunnel heartbeat as acceptance. The broker is a LOCAL owner-Windows command with no MCP/HTTP listener or arbitrary-command facility.

## Release prerequisites

- PR #3311 must be reviewed and its current exact-head Architecture Verification, native Windows broker fixture and PowerShell parser jobs must pass. An older green SHA cannot authorize release.
- Owner C:\Users\bryan\PlotPickle is tracked-clean MAIN, HEAD equals origin/main, with trusted PlotPickle Git origin. C: is live execution; G: is independently classified archive only, never active worktrees or private receipts.
- Git, authenticated gh, node.exe and Windows PowerShell 5.1+ must be available. No API keys pasted into ChatGPT or scripts; no unattended install, arbitrary PID kill or privilege escalation.
- The pre-merge preview is a separate, pinned, detached C: worktree under %LOCALAPPDATA%\PlotPickle\engineering-team\owner-windows-acceptance\preview-<PR-head>. Preparation only fetches and checks out candidate source; it does NOT execute downloaded candidate scripts or start models. Existing preview paths block instead of overwriting.

## Phase 1 — Pin source and prepare read-only preview

Open a NEW PowerShell console, leaving the existing tunnel and supervisor running. Check the exact PR/head and review the downloaded bootstrap before executing it.

~~~powershell
$ErrorActionPreference = 'Stop'
$main = 'C:\Users\bryan\PlotPickle'
$repo = 'BryanHarrisScripts/PlotPickle'
$baseHead = (& git -C $main rev-parse HEAD).Trim()
$candidateHead = (& gh pr view 3311 --repo $repo --json headRefOid --jq '.headRefOid').Trim()
if ($LASTEXITCODE -ne 0 -or $candidateHead -notmatch '^[a-f0-9]{40}$') { throw 'PR_HEAD_UNVERIFIABLE' }

$bootstrap = Join-Path $env:TEMP "Prepare-PlotPickle-AcceptancePreview-$candidateHead.ps1"
gh api -H 'Accept: application/vnd.github.raw' "/repos/BryanHarrisScripts/PlotPickle/contents/scripts/engineering-team/windows/acceptance/Prepare-PlotPickle-AcceptancePreview.ps1?ref=$candidateHead" |
    Set-Content -LiteralPath $bootstrap -Encoding UTF8
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $bootstrap -PathType Leaf)) { throw 'BOOTSTRAP_DOWNLOAD_UNVERIFIED' }
notepad $bootstrap

# After inspecting the pinned script: create the static preview only.
& $bootstrap -TrustedMainRoot $main -ExpectedMainHead $baseHead -ExpectedBrokerHead $candidateHead -Consent 'AUTHORIZE_OWNER_WINDOWS_BROKER_PREVIEW'
~~~

The state PREVIEW_CHECKED_OUT_NOT_ACCEPTED means that a pinned preview exists but candidate code was not executed. Leave failed/uncertain preview evidence untouched; no automatic deletion, reset, prune or replay.

## Phase 2 — Read local status and separately approve static staging

Use the same saved $candidateHead and $baseHead from Phase 1; never silently replace either with a newer PR head.

~~~powershell
$preview = Join-Path $env:LOCALAPPDATA "PlotPickle\engineering-team\owner-windows-acceptance\preview-$candidateHead"
$runner = Join-Path $preview 'scripts\engineering-team\windows\acceptance\Invoke-PlotPickle-WindowsAcceptance.ps1'

# No staging, model or network mutation.
& $runner -Status -TrustedMainRoot $main

# Only after reviewing the status and choosing the scoped action:
$requestId = [guid]::NewGuid().ToString('N')
& $runner -Stage -PrNumber 3311 -CandidateHead $candidateHead -ExpectedHead $baseHead -BrokerHead $candidateHead -TrustedMainRoot $main -RequestId $requestId -Consent 'AUTHORIZE_OWNER_WINDOWS_CANDIDATE_STAGE'

# Read back the same durable receipt ID, without replay.
& $runner -Receipt $requestId
~~~

The launcher checks the reviewed broker code checkout SHA and tracked cleanliness separately from the canonical clean MAIN. The existing staging adapter checks real PR identity/head, serialized stage lock, preserved inventory, actual C: disk-space floor (9 GiB), disabled hooks, detached worktree, diff and post-stage identity. STOP/PAUSE or stale supervisor/source blocks admission. Result and reservation are private, one-use records.

The only acceptable static stage result is STAGED_NOT_ACCEPTED / CANDIDATE_STATIC_STAGED with matching issue/PR, source SHA, candidate SHA, stage ID, changed file count and independent read-back. It is **not** a Product Gate PASS: no model, candidate test execution, draft publication or independent Windows witness has occurred.

BLOCKED, STARTED_UNCONFIRMED, absent/damaged receipt, stale head, low capacity or platform control denial are all fail-closed. Do not replay uncertain requests, delete worktrees, move active source to G:, or bypass intentional STOP.

## Phase 3 — Live model, independent verification and release (separate gates)

Static staging alone does not complete #3311. The next governed pilot requires a separate owner-private single-use engineering-edit-once grant, real OpenAI Responses source edit and verified local commit, then a SECOND owner-private exact-commit draft-pr-publish-once grant, confirmed draft GitHub PR and durable engineering receipt. A separately credentialed verifier must independently read GitHub CI and actual owner-Windows acceptance and validate an owner-signed witness; the coding worker must not access the signing private key or self-certify.

#3311 remains DRAFT until current exact-head PR Gate and genuine owner-Windows Product Gate both succeed, and the live edit/publication/independent-receipt chain is proven. Only then merge on the exact green head; reconcile #3314 afterward and prove restart-safe dispatch and automatic second cycle. The broker neither authorizes background coding nor merges.

Keep a sanitized copy of the preview, status, stage and receipt JSON with the exact head and CI run ID, and attach it to #3311 for owner acceptance. Never include API keys.
