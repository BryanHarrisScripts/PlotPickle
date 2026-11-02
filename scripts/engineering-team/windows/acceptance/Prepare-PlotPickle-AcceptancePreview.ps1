#Requires -Version 5.1
<#
  #3142: operator-local pre-merge installation of a VERIFIED, pinned PR preview.
  Static Git checkout only. Does NOT execute candidate code, model APIs, tests,
  the old Pi Factory or the Windows supervisor. No cleanup, reset or overwrite.
  The separately consented Invoke-PlotPickle-WindowsAcceptance.ps1 performs
  bounded native admission after this preview has been inspected.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$TrustedMainRoot,
    [Parameter(Mandatory=$true)][string]$ExpectedMainHead,
    [Parameter(Mandatory=$true)][string]$ExpectedBrokerHead,
    [Parameter(Mandatory=$true)][string]$Consent
)
$ErrorActionPreference = 'Stop'
if ($env:OS -cne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
if ($Consent -cne 'AUTHORIZE_OWNER_WINDOWS_BROKER_PREVIEW') {
    throw 'LOCAL_BROKER_PREVIEW_CONSENT_REQUIRED'
}
if ($ExpectedMainHead -cnotmatch '^[a-f0-9]{40}$' -or
    $ExpectedBrokerHead -cnotmatch '^[a-f0-9]{40}$') {
    throw 'INVALID_EXACT_HEAD'
}
if ([Console]::IsInputRedirected) { throw 'LOCAL_INTERACTIVE_CONSOLE_REQUIRED' }
$main = (Resolve-Path -LiteralPath $TrustedMainRoot -ErrorAction Stop).Path
if ([System.IO.Path]::GetPathRoot($main) -cne 'C:\' -or
    [System.IO.Path]::GetPathRoot($env:LOCALAPPDATA) -cne 'C:\') {
    throw 'ACTIVE_CHECKOUT_AND_PREVIEW_MUST_REMAIN_ON_C'
}
$origin = (& git -C $main remote get-url origin)
if ($LASTEXITCODE -ne 0 -or $origin.Trim() -cnotin @(
    'https://github.com/BryanHarrisScripts/PlotPickle.git',
    'https://github.com/BryanHarrisScripts/PlotPickle',
    'git@github.com:BryanHarrisScripts/PlotPickle.git',
    'git@github.com:BryanHarrisScripts/PlotPickle'
)) { throw 'MAIN_GIT_ORIGIN_UNVERIFIED' }
$mainHead = (& git -C $main rev-parse HEAD)
$originHead = (& git -C $main rev-parse origin/main)
$branch = (& git -C $main branch --show-current)
$dirty = & git -C $main status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or
    $mainHead.Trim() -cne $ExpectedMainHead -or
    $originHead.Trim() -cne $ExpectedMainHead -or
    $branch.Trim() -cne 'main' -or $dirty) {
    throw 'EXACT_TRACKED_CLEAN_MAIN_REQUIRED'
}
$metadataJson = & gh pr view 3311 --repo BryanHarrisScripts/PlotPickle --json number,state,baseRefName,headRefOid
if ($LASTEXITCODE -ne 0) { throw 'GITHUB_PR_IDENTITY_UNVERIFIABLE' }
$metadata = $metadataJson | ConvertFrom-Json
if ($metadata.number -ne 3311 -or $metadata.state -cne 'OPEN' -or
    $metadata.baseRefName -cne 'main' -or
    $metadata.headRefOid -cne $ExpectedBrokerHead) {
    throw 'CANDIDATE_PR_HEAD_OR_BASE_CHANGED'
}
$parent = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\owner-windows-acceptance'
$preview = Join-Path $parent ('preview-' + $ExpectedBrokerHead)
if (Test-Path -LiteralPath $preview) { throw 'PREVIEW_EXISTS_NO_OVERWRITE_OR_REPLAY' }
# Reject planted junctions in all existing owner-private parent segments.
$probe = $env:LOCALAPPDATA
foreach ($segment in @('PlotPickle','engineering-team','owner-windows-acceptance')) {
    $probe = Join-Path $probe $segment
    if (Test-Path -LiteralPath $probe) {
        $item = Get-Item -LiteralPath $probe -Force
        if (-not $item.PSIsContainer -or
            (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw 'PREVIEW_PARENT_OWNERSHIP_UNVERIFIED'
        }
    } else {
        New-Item -ItemType Directory -Path $probe -ErrorAction Stop | Out-Null
    }
}
$noHooks = Join-Path $parent 'disabled-checkout-hooks'
$oldSmudge = $env:GIT_LFS_SKIP_SMUDGE
try {
    $env:GIT_LFS_SKIP_SMUDGE = '1'
    & git -C $main -c core.longpaths=true -c "core.hooksPath=$noHooks" fetch --no-tags --no-recurse-submodules https://github.com/BryanHarrisScripts/PlotPickle.git refs/pull/3311/head
    if ($LASTEXITCODE -ne 0) { throw 'CANDIDATE_FETCH_FAILED' }
    $fetched = (& git -C $main rev-parse FETCH_HEAD)
    if ($LASTEXITCODE -ne 0 -or $fetched.Trim() -cne $ExpectedBrokerHead) {
        throw 'CANDIDATE_FETCH_HEAD_MISMATCH'
    }
    & git -C $main -c core.longpaths=true -c "core.hooksPath=$noHooks" worktree add --detach $preview $ExpectedBrokerHead
    if ($LASTEXITCODE -ne 0) { throw 'CANDIDATE_PREVIEW_CHECKOUT_UNVERIFIED' }
} finally {
    $env:GIT_LFS_SKIP_SMUDGE = $oldSmudge
}
$checked = & git -C $preview rev-parse HEAD
$previewDirty = & git -C $preview status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $checked.Trim() -cne $ExpectedBrokerHead -or $previewDirty) {
    throw 'CANDIDATE_PREVIEW_CHECKOUT_UNVERIFIED'
}
$runner = Join-Path $preview 'scripts\engineering-team\windows\acceptance\Invoke-PlotPickle-WindowsAcceptance.ps1'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
    throw 'REVIEWED_PREVIEW_LAUNCHER_MISSING'
}
[pscustomobject]@{
    state = 'PREVIEW_CHECKED_OUT_NOT_ACCEPTED'
    repo = 'BryanHarrisScripts/PlotPickle'
    candidatePrNumber = 3311
    sourceMain = $ExpectedMainHead
    candidateHead = $ExpectedBrokerHead
    previewPath = $preview
    launcherPath = $runner
    candidateExecuted = $false
    stageAdmitted = $false
    ownerWindowsAcceptance = $false
    independentVerification = $false
    replayAuthorized = $false
    automaticMergeAuthorized = $false
} | ConvertTo-Json -Compress
