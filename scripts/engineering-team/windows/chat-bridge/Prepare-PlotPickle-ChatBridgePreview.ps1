#Requires -Version 5.1
<#
 #3142: owner-Windows, pre-merge STATIC ChatGPT coding bridge preview.
 No candidate code execution, listener, tunnel proxy, tokens, owner grants,
 GitHub publication, tests, cleanup, Factory restart, or merge.
 Owner must inspect this exact pinned bootstrap BEFORE invoking it.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$TrustedMainRoot,
  [Parameter(Mandatory=$true)][string]$ExpectedMainHead,
  [Parameter(Mandatory=$true)][string]$ExpectedParentHead,
  [Parameter(Mandatory=$true)][string]$ExpectedBridgeHead,
  [Parameter(Mandatory=$true)][string]$Consent
)
$ErrorActionPreference = 'Stop'
if ($env:OS -cne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
if ($Consent -cne 'AUTHORIZE_STATIC_CHAT_BRIDGE_PREVIEW_ONLY') {
  throw 'OWNER_STATIC_PREVIEW_CONSENT_REQUIRED'
}
if ([Console]::IsInputRedirected) { throw 'OWNER_INTERACTIVE_CONSOLE_REQUIRED' }
foreach ($sha in @($ExpectedMainHead,$ExpectedParentHead,$ExpectedBridgeHead)) {
  if ($sha -cnotmatch '^[a-f0-9]{40}$') { throw 'PINNED_SHA_REQUIRED' }
}
if ($ExpectedMainHead -ceq $ExpectedBridgeHead -or $ExpectedParentHead -ceq $ExpectedBridgeHead) {
  throw 'MIXED_CHECKOUT_IDENTITIES'
}
$repo = 'BryanHarrisScripts/PlotPickle'
$expectedBridgeBase = 'feat/3142-authorized-one-shot-coding-worker'
$main = (Resolve-Path -LiteralPath $TrustedMainRoot -ErrorAction Stop).Path
if ([System.IO.Path]::GetPathRoot($main) -cne 'C:\' -or
    [System.IO.Path]::GetPathRoot($env:LOCALAPPDATA) -cne 'C:\') {
  throw 'LIVE_CODE_MUST_REMAIN_ON_C'
}
$mainInfo = Get-Item -LiteralPath $main -Force
if (-not $mainInfo.PSIsContainer -or
    (($mainInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
  throw 'TRUSTED_MAIN_DIRECTORY_UNVERIFIABLE'
}
function ReadGit([string[]]$GitArgs) {
  $out = & git -C $main @GitArgs
  if ($LASTEXITCODE -ne 0) { throw 'OWNER_GIT_READ_UNVERIFIABLE' }
  return (($out | Out-String).Trim())
}
$origin = ReadGit -GitArgs @('remote','get-url','origin')
if ($origin -cnotin @(
    'https://github.com/BryanHarrisScripts/PlotPickle.git',
    'https://github.com/BryanHarrisScripts/PlotPickle',
    'git@github.com:BryanHarrisScripts/PlotPickle.git',
    'git@github.com:BryanHarrisScripts/PlotPickle')) {
  throw 'OWNER_MAIN_ORIGIN_NOT_TRUSTED'
}
$head = ReadGit -GitArgs @('rev-parse','HEAD')
$mainRemote = ReadGit -GitArgs @('rev-parse','origin/main')
$branch = ReadGit -GitArgs @('branch','--show-current')
$dirty = ReadGit -GitArgs @('status','--porcelain','--untracked-files=no')
if ($head -cne $ExpectedMainHead -or $mainRemote -cne $ExpectedMainHead -or
    $branch -cne 'main' -or $dirty.Length -ne 0) {
  throw 'OWNER_EXACT_CLEAN_MAIN_REQUIRED'
}
$parentJson = & gh pr view 3311 --repo $repo --json number,state,baseRefName,headRefOid
if ($LASTEXITCODE -ne 0) { throw 'PARENT_PR_UNVERIFIABLE' }
$parent = $parentJson | ConvertFrom-Json
if ($parent.number -ne 3311 -or $parent.state -cne 'OPEN' -or
    $parent.baseRefName -cne 'main' -or
    $parent.headRefOid -cne $ExpectedParentHead) {
  throw 'PARENT_PR_PIN_MISMATCH'
}
$bridgeJson = & gh pr view 3314 --repo $repo --json number,state,baseRefName,headRefOid
if ($LASTEXITCODE -ne 0) { throw 'BRIDGE_PR_UNVERIFIABLE' }
$bridge = $bridgeJson | ConvertFrom-Json
if ($bridge.number -ne 3314 -or $bridge.state -cne 'OPEN' -or
    $bridge.baseRefName -cne $expectedBridgeBase -or
    $bridge.headRefOid -cne $ExpectedBridgeHead) {
  throw 'BRIDGE_PR_PIN_MISMATCH'
}
$parentPath = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\chat-bridge-preview'
$preview = Join-Path $parentPath ('preview-' + $ExpectedBridgeHead)
if (Test-Path -LiteralPath $preview) { throw 'CHAT_BRIDGE_PREVIEW_EXISTS_NO_OVERWRITE' }
# Refuse a preexisting private junction or symlink; never traverse into it.
$cursor = $env:LOCALAPPDATA
foreach ($segment in @('PlotPickle','engineering-team','chat-bridge-preview')) {
  $cursor = Join-Path $cursor $segment
  if (Test-Path -LiteralPath $cursor) {
    $node = Get-Item -LiteralPath $cursor -Force
    if (-not $node.PSIsContainer -or
        (($node.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
      throw 'UNTRUSTED_PREVIEW_PARENT'
    }
  } else { New-Item -ItemType Directory -Path $cursor -ErrorAction Stop | Out-Null }
}
$disabledHooks = Join-Path $parentPath 'disabled-git-hooks'
$oldSmudge = $env:GIT_LFS_SKIP_SMUDGE
try {
  $env:GIT_LFS_SKIP_SMUDGE = '1'
  & git -C $main -c core.longpaths=true -c "core.hooksPath=$disabledHooks" fetch --no-tags --no-recurse-submodules https://github.com/BryanHarrisScripts/PlotPickle.git refs/pull/3314/head
  if ($LASTEXITCODE -ne 0) { throw 'PINNED_BRIDGE_FETCH_FAILED' }
  $fetchHead = ReadGit -GitArgs @('rev-parse','FETCH_HEAD')
  if ($fetchHead -cne $ExpectedBridgeHead) { throw 'PINNED_BRIDGE_FETCH_HEAD_CHANGED' }
  & git -C $main -c core.longpaths=true -c "core.hooksPath=$disabledHooks" worktree add --detach $preview $ExpectedBridgeHead
  if ($LASTEXITCODE -ne 0) { throw 'PREVIEW_CREATION_UNCERTAIN_STOP' }
} finally { $env:GIT_LFS_SKIP_SMUDGE = $oldSmudge }
$actual = & git -C $preview rev-parse HEAD
$state = & git -C $preview status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $actual.Trim() -cne $ExpectedBridgeHead -or $state) {
  throw 'PREVIEW_CHECKOUT_UNVERIFIABLE'
}
$files = @(
  'scripts\engineering-team\mcp\dispatcher\engineering-dispatcher-plugin.mjs',
  'scripts\engineering-team\gateway\chat\owner-chat-edit-once.mjs',
  'scripts\engineering-team\gateway\chat\owner-chat-pilot-grant.mjs',
  'tests\issue-3142-chatgpt-patch-once.test.mjs'
)
foreach ($file in $files) {
  $item = Get-Item -LiteralPath (Join-Path $preview $file) -ErrorAction Stop -Force
  if ($item.PSIsContainer -or
      (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'REVIEWED_BRIDGE_SOURCE_MISSING_OR_UNTRUSTED'
  }
}
if ((ReadGit -GitArgs @('rev-parse','HEAD')) -cne $ExpectedMainHead -or
    (ReadGit -GitArgs @('status','--porcelain','--untracked-files=no')).Length -ne 0) {
  throw 'OWNER_MAIN_CHANGED_DURING_PREVIEW'
}
[pscustomobject]@{
  state = 'CHAT_BRIDGE_PREVIEW_CHECKED_OUT_NOT_ACCEPTED'
  sourceMain = $ExpectedMainHead
  parentHead = $ExpectedParentHead
  bridgeHead = $ExpectedBridgeHead
  previewPath = $preview
  candidateExecuted = $false
  tunnelStarted = $false
  grantIssued = $false
  codeEdited = $false
  pullRequestCreated = $false
  independentVerification = $false
  automaticMergeAuthorized = $false
  replayAuthorized = $false
} | ConvertTo-Json -Compress
