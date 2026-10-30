#Requires -Version 5.1
# #3142 owner-Windows read-only Scheduled Task identity acceptance for PR #3348.
# Requires the separately staged, exact-head candidate worktree supplied by
# the authenticated Factory engineering runner. No registration or source writes.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ExpectedMainHead
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'OWNER_WINDOWS_ONLY' }
if ($ExpectedMainHead -cnotmatch '^[0-9a-f]{40}
$branch = (& git -C $main branch --show-current).Trim()
$head = (& git -C $main rev-parse HEAD).Trim()
$dirty = & git -C $main status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $branch -cne 'main' -or
    $head -cne $ExpectedMainHead -or $dirty) { throw 'MAIN_SOURCE_CHANGED_OR_DIRTY' }
$origin = (& git -C $main remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -cnotmatch '^(https://github[.]com/BryanHarrisScripts/PlotPickle([.]git)?|git@github[.]com:BryanHarrisScripts/PlotPickle([.]git)?)$') {
  throw 'UNTRUSTED_MAIN_ORIGIN'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$source = Join-Path $PSScriptRoot 'Install-PlotPickleFactoryWorkers.ps1'
$installer = Get-Content -LiteralPath $source -Raw -ErrorAction Stop
if (-not $installer.Contains('function Test-TaskPrincipalIsCurrentUser') -or
    -not $installer.Contains('Test-TaskPrincipalIsCurrentUser ([string]$task.Principal.UserId)')) {
  throw 'CANDIDATE_SID_OWNER_GUARD_MISSING'
}
function Test-OwnerSid([string]$taskUserId) {
  if ([string]::IsNullOrWhiteSpace($taskUserId)) { return $false }
  if ($taskUserId -ceq $owner.User.Value) { return $true }
  try {
    $sid = (New-Object System.Security.Principal.NTAccount($taskUserId)).Translate(
      [System.Security.Principal.SecurityIdentifier])
    if ($sid.Value -ceq $owner.User.Value) { return $true }
  } catch { }
  if ($taskUserId -match '^[^\\]+$') {
    try {
      $local = (New-Object System.Security.Principal.NTAccount($env:COMPUTERNAME,$taskUserId)).Translate(
        [System.Security.Principal.SecurityIdentifier])
      return $local.Value -ceq $owner.User.Value
    } catch { return $false }
  }
  return $false
}
# Negative controls: different local system SID and malformed principal are denied.
if (Test-OwnerSid 'S-1-5-18') { throw 'PRINCIPAL_NEGATIVE_CONTROL_FAILED' }
if (Test-OwnerSid 'this-user-does-not-exist-plotpickle-test') { throw 'UNRESOLVED_PRINCIPAL_ACCEPTED' }
$names = @('PlotPickleCodingDispatcher','PlotPickleCodingWorker1','PlotPickleCodingWorker2')
$roles = @('coding-dispatcher','coding-worker-1','coding-worker-2')
$script = Join-Path $main 'scripts\engineering-team\gateway\worker-pool\worker-host.mjs'
$verified = @()
for ($i=0; $i -lt $names.Count; $i++) {
  $tasks = @(Get-ScheduledTask -TaskName $names[$i] -ErrorAction SilentlyContinue)
  if ($tasks.Count -ne 1) { throw ('TASK_NOT_UNIQUELY_REGISTERED: ' + $names[$i]) }
  $task = $tasks[0]
  $actions = @($task.Actions)
  $expectedArgs = ('"{0}" --serve {1}' -f $script,$roles[$i])
  if ($task.TaskPath -cne '\' -or $actions.Count -ne 1 -or
      $actions[0].Execute -cne $node -or
      $actions[0].Arguments -cne $expectedArgs -or
      $actions[0].WorkingDirectory -cne $main -or
      -not (Test-OwnerSid ([string]$task.Principal.UserId))) {
    throw ('WORKER_TASK_OWNERSHIP_UNVERIFIED: ' + $names[$i])
  }
  if ([string]$task.State -cne 'Disabled') { throw ('TASK_UNEXPECTEDLY_ENABLED: ' + $names[$i]) }
  $verified += $names[$i]
}
[pscustomobject]@{
  state='OWNER_WINDOWS_TASK_SID_VERIFIED'
  sourceHead=$head
  verifiedTasks=$verified
  allDisabled=$true
  exactActionAndPath=$true
  ownerSidVerified=$true
  signedF00ServiceVerified=$false
  dispatcherOnline=$false
  automaticMergeEnabled=$false
  testMutatedTasks=$false
} | ConvertTo-Json -Compress
) { throw 'INVALID_EXPECTED_MAIN_HEAD' }
# The canonical working directory is read from the existing owner task;
# accepting an arbitrary path from a tool caller is intentionally forbidden.
$dispatcherTasks = @(Get-ScheduledTask -TaskName 'PlotPickleCodingDispatcher' -ErrorAction SilentlyContinue)
if ($dispatcherTasks.Count -ne 1 -or @($dispatcherTasks[0].Actions).Count -ne 1) { throw 'DISPATCHER_TASK_UNVERIFIABLE' }
$taskMain = [string]$dispatcherTasks[0].Actions[0].WorkingDirectory
if ([string]::IsNullOrWhiteSpace($taskMain)) { throw 'DISPATCHER_WORKING_DIRECTORY_MISSING' }
$main = (Resolve-Path -LiteralPath $taskMain -ErrorAction Stop).Path
$branch = (& git -C $main branch --show-current).Trim()
$head = (& git -C $main rev-parse HEAD).Trim()
$dirty = & git -C $main status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $branch -cne 'main' -or
    $head -cne $ExpectedMainHead -or $dirty) { throw 'MAIN_SOURCE_CHANGED_OR_DIRTY' }
$origin = (& git -C $main remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -cnotmatch '^(https://github[.]com/BryanHarrisScripts/PlotPickle([.]git)?|git@github[.]com:BryanHarrisScripts/PlotPickle([.]git)?)$') {
  throw 'UNTRUSTED_MAIN_ORIGIN'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$source = Join-Path $PSScriptRoot 'Install-PlotPickleFactoryWorkers.ps1'
$installer = Get-Content -LiteralPath $source -Raw -ErrorAction Stop
if (-not $installer.Contains('function Test-TaskPrincipalIsCurrentUser') -or
    -not $installer.Contains('Test-TaskPrincipalIsCurrentUser ([string]$task.Principal.UserId)')) {
  throw 'CANDIDATE_SID_OWNER_GUARD_MISSING'
}
function Test-OwnerSid([string]$taskUserId) {
  if ([string]::IsNullOrWhiteSpace($taskUserId)) { return $false }
  if ($taskUserId -ceq $owner.User.Value) { return $true }
  try {
    $sid = (New-Object System.Security.Principal.NTAccount($taskUserId)).Translate(
      [System.Security.Principal.SecurityIdentifier])
    if ($sid.Value -ceq $owner.User.Value) { return $true }
  } catch { }
  if ($taskUserId -match '^[^\\]+$') {
    try {
      $local = (New-Object System.Security.Principal.NTAccount($env:COMPUTERNAME,$taskUserId)).Translate(
        [System.Security.Principal.SecurityIdentifier])
      return $local.Value -ceq $owner.User.Value
    } catch { return $false }
  }
  return $false
}
# Negative controls: different local system SID and malformed principal are denied.
if (Test-OwnerSid 'S-1-5-18') { throw 'PRINCIPAL_NEGATIVE_CONTROL_FAILED' }
if (Test-OwnerSid 'this-user-does-not-exist-plotpickle-test') { throw 'UNRESOLVED_PRINCIPAL_ACCEPTED' }
$names = @('PlotPickleCodingDispatcher','PlotPickleCodingWorker1','PlotPickleCodingWorker2')
$roles = @('coding-dispatcher','coding-worker-1','coding-worker-2')
$script = Join-Path $main 'scripts\engineering-team\gateway\worker-pool\worker-host.mjs'
$verified = @()
for ($i=0; $i -lt $names.Count; $i++) {
  $tasks = @(Get-ScheduledTask -TaskName $names[$i] -ErrorAction SilentlyContinue)
  if ($tasks.Count -ne 1) { throw ('TASK_NOT_UNIQUELY_REGISTERED: ' + $names[$i]) }
  $task = $tasks[0]
  $actions = @($task.Actions)
  $expectedArgs = ('"{0}" --serve {1}' -f $script,$roles[$i])
  if ($task.TaskPath -cne '\' -or $actions.Count -ne 1 -or
      $actions[0].Execute -cne $node -or
      $actions[0].Arguments -cne $expectedArgs -or
      $actions[0].WorkingDirectory -cne $main -or
      -not (Test-OwnerSid ([string]$task.Principal.UserId))) {
    throw ('WORKER_TASK_OWNERSHIP_UNVERIFIED: ' + $names[$i])
  }
  if ([string]$task.State -cne 'Disabled') { throw ('TASK_UNEXPECTEDLY_ENABLED: ' + $names[$i]) }
  $verified += $names[$i]
}
[pscustomobject]@{
  state='OWNER_WINDOWS_TASK_SID_VERIFIED'
  sourceHead=$head
  verifiedTasks=$verified
  allDisabled=$true
  exactActionAndPath=$true
  ownerSidVerified=$true
  signedF00ServiceVerified=$false
  dispatcherOnline=$false
  automaticMergeEnabled=$false
  testMutatedTasks=$false
} | ConvertTo-Json -Compress
