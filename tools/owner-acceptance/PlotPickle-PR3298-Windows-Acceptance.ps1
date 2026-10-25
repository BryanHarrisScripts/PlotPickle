# PlotPickle #3298: one-shot, non-destructive owner Windows PR-stage acceptance.
# Fixed identity; does not merge, prune Git worktrees, run Pi, install dependencies,
# start/stop apps or services, or modify the tracked MAIN checkout.
# A passing focused fixture is NOT independent verification or the Product Gate.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$prNumber = 3298
$baseHead = 'd94c535d8d54db4abd9d1c27db06cce0d20142c8'
$candidateHead = 'ba4f781789b22593b50a74382b87629ce98ba2e0'
$trustedOrigin = 'https://github.com/BryanHarrisScripts/PlotPickle.git'
$repo = Join-Path $HOME 'PlotPickle'
$factoryRoot = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\autonomous-queue'
$stageRoot = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\owner-pr-acceptance'
$stagePath = Join-Path $stageRoot ('pr-' + $prNumber + '-' + $candidateHead.Substring(0, 12))
$lockPath = Join-Path $factoryRoot '.candidate-stage-budget.lock'
$receiptPath = Join-Path $stageRoot ('receipt-pr-' + $prNumber + '-' + $candidateHead.Substring(0, 12) + '.json')
$lockHandle = $null
$oldLfsSmudge = $env:GIT_LFS_SKIP_SMUDGE
$oldGitPrompt = $env:GIT_TERMINAL_PROMPT
$stageCreated = $false
$report = [ordered]@{
    schemaVersion = 1
    suite = 'OWNER_WINDOWS_ISOLATED_STAGE_AND_FOCUSED_TESTS'
    prNumber = $prNumber
    baseHead = $baseHead
    candidateHead = $candidateHead
    state = 'BLOCKED'
    code = 'PREFLIGHT_NOT_COMPLETED'
    stageVerified = $false
    focusedTestsPassed = $false
    supervisorObserved = $false
    supervisorState = $null
    supervisorLastResult = $null
    supervisorRestartCount = $null
    supervisorStartWhenAvailable = $null
    ownerWindowsProductGateVerified = $false
    independentVerification = $false
    automaticMergeAuthorized = $false
    legacyStagesTouched = $false
    separateWorktreeRegistered = $false
    observedLegacyStages = $null
    diskFreeBytesBefore = $null
    diskFreeBytesAfter = $null
    recordedUtc = $null
}

function Invoke-VerifiedGit {
    param([string[]] $Arguments, [string] $Code)
    $output = @(& git @Arguments)
    if ($LASTEXITCODE -ne 0) { throw $Code }
    return ($output -join "`n").Trim()
}

try {
    if (-not (Test-Path -LiteralPath $repo -PathType Container)) { throw 'REPOSITORY_NOT_FOUND' }
    if (-not (Test-Path -LiteralPath $factoryRoot -PathType Container)) { throw 'FACTORY_PRIVATE_ROOT_MISSING' }

    $origin = Invoke-VerifiedGit -Arguments @('-C', $repo, 'remote', 'get-url', 'origin') -Code 'ORIGIN_UNVERIFIED'
    $allowedOrigins = @($trustedOrigin, 'https://github.com/BryanHarrisScripts/PlotPickle',
        'git@github.com:BryanHarrisScripts/PlotPickle.git', 'git@github.com:BryanHarrisScripts/PlotPickle')
    if ($origin -notin $allowedOrigins) { throw 'ORIGIN_NOT_TRUSTED' }

    $branch = Invoke-VerifiedGit -Arguments @('-C', $repo, 'branch', '--show-current') -Code 'BRANCH_UNVERIFIED'
    $main = Invoke-VerifiedGit -Arguments @('-C', $repo, 'rev-parse', 'HEAD') -Code 'MAIN_HEAD_UNVERIFIED'
    $remoteMain = Invoke-VerifiedGit -Arguments @('-C', $repo, 'rev-parse', 'origin/main') -Code 'MAIN_REMOTE_UNVERIFIED'
    $tracked = Invoke-VerifiedGit -Arguments @('-C', $repo, 'status', '--porcelain', '--untracked-files=no') -Code 'MAIN_STATUS_UNVERIFIED'
    if ($branch -cne 'main' -or $main -cne $baseHead -or $remoteMain -cne $baseHead -or $tracked -ne '') {
        throw 'EXACT_CLEAN_MAIN_REQUIRED'
    }

    if (Test-Path -LiteralPath $lockPath) { throw 'CANONICAL_STAGE_LOCK_HELD_OR_UNVERIFIED' }
    if (Test-Path -LiteralPath $stagePath) { throw 'PREEXISTING_OWNER_STAGE_PRESERVED' }
    if (Test-Path -LiteralPath $receiptPath) { throw 'PR_RECEIPT_EXISTS_NO_REPLAY' }

    $legacyBase = Join-Path $factoryRoot 'chat-candidate-stages'
    if (Test-Path -LiteralPath $legacyBase -PathType Container) {
        $report.observedLegacyStages = @(Get-ChildItem -LiteralPath $legacyBase -Directory -Force).Count
    }

    if (-not (Test-Path -LiteralPath $stageRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $stageRoot -ErrorAction Stop | Out-Null
    }
    $stageInfo = Get-Item -LiteralPath $stageRoot -Force
    if (($stageInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'OWNER_STAGE_ROOT_REPARSE_POINT'
    }

    $driveName = [IO.Path]::GetPathRoot($stageRoot).Substring(0, 1)
    $freeBefore = [int64](Get-PSDrive -Name $driveName -PSProvider FileSystem).Free
    $report.diskFreeBytesBefore = $freeBefore
    if ($freeBefore -lt 9GB) { throw 'BLOCK_RESOURCE_PRESSURE_BELOW_9GIB' }

    # Exclusive, create-new file blocks the installed mkdir-based stage lock too.
    # Only this script's exact file handle is released; no existing lock is removed.
    $lockHandle = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)

    $env:GIT_LFS_SKIP_SMUDGE = '1'
    $env:GIT_TERMINAL_PROMPT = '0'
    $null = Invoke-VerifiedGit -Arguments @('-C', $repo, 'fetch', '--no-tags', '--no-recurse-submodules',
        $trustedOrigin, ('refs/pull/' + $prNumber + '/head')) -Code 'PINNED_PR_FETCH_FAILED'
    $fetched = Invoke-VerifiedGit -Arguments @('-C', $repo, 'rev-parse', 'FETCH_HEAD') -Code 'FETCH_HEAD_UNVERIFIED'
    if ($fetched -cne $candidateHead) { throw 'CANDIDATE_HEAD_CHANGED_NO_CHECKOUT' }

    $disabledHooks = Join-Path $stageRoot 'hooks-disabled'
    $null = Invoke-VerifiedGit -Arguments @('-C', $repo, '-c', 'core.longpaths=true', '-c',
        ('core.hooksPath=' + $disabledHooks), 'worktree', 'add', '--detach', $stagePath, $candidateHead) `
        -Code 'OWNER_ISOLATED_STAGE_CREATION_FAILED'
    $stageCreated = $true
    $report.separateWorktreeRegistered = $true

    $actualHead = Invoke-VerifiedGit -Arguments @('-C', $stagePath, 'rev-parse', 'HEAD') -Code 'STAGE_HEAD_UNVERIFIED'
    $status = Invoke-VerifiedGit -Arguments @('-C', $stagePath, 'status', '--porcelain', '--untracked-files=no') -Code 'STAGE_STATUS_UNVERIFIED'
    if ($actualHead -cne $candidateHead -or $status -ne '') { throw 'STAGE_HEAD_OR_TRACKED_FILES_MISMATCH' }
    $null = Invoke-VerifiedGit -Arguments @('-C', $stagePath, 'diff', '--check', $baseHead, $candidateHead) -Code 'CANDIDATE_DIFF_CHECK_FAILED'
    $report.stageVerified = $true

    $freeAfter = [int64](Get-PSDrive -Name $driveName -PSProvider FileSystem).Free
    $report.diskFreeBytesAfter = $freeAfter
    if ($freeAfter -lt 8GB) { throw 'POST_STAGE_RESOURCE_PRESSURE_BELOW_8GIB' }

    $node = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $node) { throw 'NODE_RUNTIME_NOT_AVAILABLE' }
    # Execute only three named, deterministic regression suites on the fixed PR.
    # No npm install, provider call, or arbitrary user-supplied path/command.
    $testPaths = @(
        (Join-Path $stagePath 'tests\issue-3241-stage-growth-budget.test.mjs'),
        (Join-Path $stagePath 'tests\issue-3241-disk-space-preflight.test.mjs'),
        (Join-Path $stagePath 'tests\issue-3154-chatgpt-factory-mcp.test.mjs')
    )
    & node '--test' '--test-concurrency=1' @testPaths
    if ($LASTEXITCODE -ne 0) { throw 'FOCUSED_WINDOWS_TESTS_FAILED' }
    $report.focusedTestsPassed = $true

    $headAgain = Invoke-VerifiedGit -Arguments @('-C', $stagePath, 'rev-parse', 'HEAD') -Code 'STAGE_RECHECK_FAILED'
    $stageTrackedAgain = Invoke-VerifiedGit -Arguments @('-C', $stagePath, 'status', '--porcelain', '--untracked-files=no') -Code 'STAGE_RECHECK_FAILED'
    $mainAgain = Invoke-VerifiedGit -Arguments @('-C', $repo, 'rev-parse', 'HEAD') -Code 'MAIN_RECHECK_FAILED'
    $mainTrackedAgain = Invoke-VerifiedGit -Arguments @('-C', $repo, 'status', '--porcelain', '--untracked-files=no') -Code 'MAIN_RECHECK_FAILED'
    if ($headAgain -cne $candidateHead -or $stageTrackedAgain -ne '' -or
        $mainAgain -cne $baseHead -or $mainTrackedAgain -ne '') {
        throw 'SOURCE_CHANGED_DURING_ACCEPTANCE'
    }

    # Read-only observation; a ready task is NOT a running watchdog.
    if (Get-Command 'Get-ScheduledTask' -ErrorAction SilentlyContinue) {
        $task = Get-ScheduledTask -TaskName 'PlotPickleIndependentSupervisor' -ErrorAction SilentlyContinue
        if ($task) {
            $report.supervisorObserved = $true
            $report.supervisorState = [string]$task.State
            $report.supervisorRestartCount = [int]$task.Settings.RestartCount
            $report.supervisorStartWhenAvailable = [bool]$task.Settings.StartWhenAvailable
            $taskInfo = Get-ScheduledTaskInfo -TaskName $task.TaskName -ErrorAction SilentlyContinue
            if ($taskInfo) { $report.supervisorLastResult = [int]$taskInfo.LastTaskResult }
        }
    }
    $report.state = 'TEST_PASSED'
    $report.code = 'OWNER_STAGE_AND_FOCUSED_REGRESSIONS_PASSED'
}
catch {
    # Use a bounded, non-secret error family rather than publishing file paths,
    # credentials or arbitrary OS exception strings in the receipt.
    if ($report.code -eq 'PREFLIGHT_NOT_COMPLETED') {
        $reason = [string]$_.Exception.Message
        if ($reason -match '^[A-Z][A-Z0-9_]+$') { $report.code = $reason }
        else { $report.code = 'OWNER_ACCEPTANCE_UNVERIFIED' }
    }
}
finally {
    $env:GIT_LFS_SKIP_SMUDGE = $oldLfsSmudge
    $env:GIT_TERMINAL_PROMPT = $oldGitPrompt
    if ($lockHandle) {
        $lockHandle.Dispose()
        try {
            $lockItem = Get-Item -LiteralPath $lockPath -Force -ErrorAction Stop
            if (-not $lockItem.PSIsContainer -and
                ($lockItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
                [System.IO.File]::Delete($lockPath)
            }
        } catch {
            $report.state = 'BLOCKED'
            $report.code = 'OWNED_STAGE_LOCK_RELEASE_UNVERIFIED'
        }
    }
    $report.recordedUtc = [DateTime]::UtcNow.ToString('o')
    # A failed stage can remain on disk intentionally. No cleanup is attempted.
    if ($stageCreated) { $report.legacyStagesTouched = $false }
    if (Test-Path -LiteralPath $stageRoot -PathType Container) {
        try {
            $json = ($report | ConvertTo-Json -Depth 5)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json + "`n")
            $stream = [System.IO.File]::Open($receiptPath, [System.IO.FileMode]::CreateNew,
                [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
            finally { $stream.Dispose() }
        } catch { Write-Warning 'Immutable receipt not saved; do not replay this attempt automatically.' }
    }
    $report | ConvertTo-Json -Depth 5
    if ($report.state -ne 'TEST_PASSED') {
        Write-Warning 'Owner acceptance blocked. Existing stage/worktrees were preserved; do not auto-retry or delete.'
    }
}
