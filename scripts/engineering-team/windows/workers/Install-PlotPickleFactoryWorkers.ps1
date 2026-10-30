#Requires -Version 5.1
# #3142 candidate; F00 remains a separately signed restricted Windows service.
[CmdletBinding()]
param(
  [switch]$Plan, [switch]$Status, [switch]$Install,
  [switch]$Start, [switch]$Stop, [switch]$Uninstall,
  [string]$Consent = ''
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'OWNER_WINDOWS_ONLY' }
$operations = @(@($Plan,$Status,$Install,$Start,$Stop,$Uninstall) | Where-Object { $_ })
if ($operations.Count -ne 1) { throw 'EXACTLY_ONE_WORKER_OPERATION_REQUIRED' }
$required = 'ENABLE_PLOTPICKLE_FACTORY_WORKER_POOL'
if (($Install -or $Start -or $Uninstall) -and $Consent -cne $required) { throw 'EXPLICIT_CONSENT_REQUIRED' }
if (($Plan -or $Status -or $Stop) -and $Consent -ne '') { throw 'UNSUPPORTED_CONSENT' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$script = Join-Path $repo 'scripts\engineering-team\gateway\worker-pool\worker-host.mjs'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'WORKER_HOST_MISSING' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$who = [System.Security.Principal.WindowsIdentity]::GetCurrent()
# One entry point, one implementation, five separate worker IDs.
$names = @('PlotPickleCodingDispatcher') + @(1..5 | ForEach-Object { 'PlotPickleCodingWorker' + $_ })
$roles = @('coding-dispatcher') + @(1..5 | ForEach-Object { 'coding-worker-' + $_ })
function ExactHead {
  $branch = (& git -C $repo branch --show-current).Trim()
  $head = (& git -C $repo rev-parse HEAD).Trim()
  $dirty = & git -C $repo status --porcelain --untracked-files=no
  if ($LASTEXITCODE -ne 0 -or $branch -cne 'main' -or $head -cnotmatch '^[a-f0-9]{40}$' -or $dirty) { throw 'EXACT_CLEAN_MAIN_REQUIRED' }
  return $head
}
# Resolve Scheduled Task principal to a SID; never trust username-only equality.
function Test-TaskPrincipalIsCurrentUser([string]$taskUserId) {
    if ([string]::IsNullOrWhiteSpace($taskUserId)) { return $false }
    # Task Scheduler may normalize DOMAIN\user to user. Require SID equality.
    $current = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    if ($taskUserId -eq $current.User.Value) { return $true }
    try {
        $resolved = (New-Object System.Security.Principal.NTAccount($taskUserId)).Translate(
            [System.Security.Principal.SecurityIdentifier])
        if ($resolved.Value -eq $current.User.Value) { return $true }
    } catch {
        # A bare local username can fail NTAccount translation on some hosts.
    }
    # Resolve the unqualified name explicitly against this machine only.
    if ($taskUserId -match '^[^\\]+$') {
        try {
            $local = (New-Object System.Security.Principal.NTAccount($env:COMPUTERNAME, $taskUserId)).Translate(
                [System.Security.Principal.SecurityIdentifier])
            return $local.Value -eq $current.User.Value
        } catch { return $false }
    }
    return $false
}
function OwnedTask([int]$i) {
  $list = @(Get-ScheduledTask -TaskName $names[$i] -ErrorAction SilentlyContinue)
  if ($list.Count -eq 0) { return $null }
  if ($list.Count -ne 1) { throw 'WORKER_TASK_AMBIGUOUS' }
  $task = $list[0]
  $args = ('"{0}" --serve {1}' -f $script,$roles[$i])
  if ($task.TaskPath -ne '\' -or @($task.Actions).Count -ne 1 -or
      $task.Actions[0].Execute -cne $node -or $task.Actions[0].Arguments -cne $args -or
      $task.Actions[0].WorkingDirectory -cne $repo -or
      -not (Test-TaskPrincipalIsCurrentUser ([string]$task.Principal.UserId))) { throw 'WORKER_TASK_OWNERSHIP_UNVERIFIED' }
  return $task
}
if ($Plan) {
  [pscustomobject]@{ state='PLAN_ONLY'; sourceHead=(ExactHead); reviewer='F00_SIGNED_SERVICE_REQUIRED'; dispatcher='DISABLED'; worker1='DISABLED'; worker2To5='PARKED_RELEASE_AND_CAPACITY_PROOF_REQUIRED'; modelInvoked=$false; mergeEnabled=$false } | ConvertTo-Json -Compress
  return
}
if ($Status) {
  $tasks=@()
  for($i=0;$i -lt 3;$i++) {
    $t=OwnedTask $i
    $tasks += [pscustomobject]@{name=$names[$i];role=$roles[$i];state=$(if($null -eq $t){'NOT_INSTALLED'}else{[string]$t.State});processVerified=$false}
  }
  $service=@(Get-Service -Name 'PlotPickleLaneA' -ErrorAction SilentlyContinue)
  [pscustomobject]@{ state='OBSERVATION_ONLY'; reviewer=$(if($service.Count){'SCM_PRESENT_NOT_QUALIFIED'}else{'NOT_INSTALLED'});tasks=$tasks;verifiedCycles=0;mergeEnabled=$false } | ConvertTo-Json -Depth 5 -Compress
  return
}
# Preserve old Pi receipts and scheduled-task registration. An already
# DISABLED legacy task may coexist; an enabled one must be disabled by its
# owner before admission, because it could race the new dispatcher.
$legacy = @(Get-ScheduledTask -TaskName 'PlotPickleSoftwareFactory' -ErrorAction SilentlyContinue)
if ($legacy.Count -gt 1) { throw 'LEGACY_PI_TASK_AMBIGUOUS' }
if ($legacy.Count -eq 1 -and [string]$legacy[0].State -ne 'Disabled') {
  throw 'LEGACY_PI_TASK_MUST_BE_DISABLED_BEFORE_DISPATCHER_START'
}
if ($Install) {
  $null=ExactHead
  for($i=0;$i -lt 3;$i++){ if(@(Get-ScheduledTask -TaskName $names[$i] -ErrorAction SilentlyContinue).Count){ throw 'EXISTING_TASK_WILL_NOT_BE_OVERWRITTEN' } }
  $done=@()
  try {
    for($i=0;$i -lt 3;$i++) {
      $action=New-ScheduledTaskAction -Execute $node -Argument ('"{0}" --serve {1}' -f $script,$roles[$i]) -WorkingDirectory $repo
      $trigger=New-ScheduledTaskTrigger -AtLogOn -User $who.Name
      $principal=New-ScheduledTaskPrincipal -UserId $who.Name -LogonType Interactive -RunLevel Limited
      $settings=New-ScheduledTaskSettingsSet -Disable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
      Register-ScheduledTask -TaskName $names[$i] -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
      $done += $names[$i]
    }
  } catch { throw 'PARTIAL_REGISTRATION_REQUIRES_RECONCILIATION_NO_AUTO_DELETE' }
  [pscustomobject]@{ state='REGISTERED_DISABLED';tasks=$done;reviewer='F00_EXTERNAL_SERVICE_REQUIRED';codingOnline=$false } | ConvertTo-Json -Compress
  return
}
if ($Start) {
  $head=ExactHead
  $task=OwnedTask 0
  if ($null -eq $task) { throw 'DISPATCHER_TASK_NOT_INSTALLED' }
  # Never enable worker slots or the legacy Pi queue. The dispatcher will
  # consume ONLY existing owner one-shot grants through Worker 1.
  $supervisor=Join-Path $repo 'scripts\engineering-team\windows\supervisor\unattended-supervisor.mjs'
  $statusJson = & $node $supervisor --status
  if ($LASTEXITCODE -ne 0) { throw 'SUPERVISOR_STATUS_UNVERIFIABLE' }
  $status = $statusJson | ConvertFrom-Json
  if ($status.state -cne 'RUNNING' -or $status.exactSha -cne $head -or
      $status.pauseAcknowledged -eq $true) { throw 'SUPERVISOR_STOP_PAUSE_OR_HEAD_UNVERIFIED' }
  if ([string]$task.State -eq 'Running') { throw 'DISPATCHER_ALREADY_RUNNING_RECHECK_STATUS' }
  Enable-ScheduledTask -TaskName $names[0] -ErrorAction Stop | Out-Null
  Start-ScheduledTask -TaskName $names[0] -ErrorAction Stop
  [pscustomobject]@{state='START_REQUESTED';task=$names[0];sourceHead=$head;
    worker1Only=$true;legacyPiStarted=$false;mergeEnabled=$false;
    liveProcessVerified=$false;message='Run native-dispatcher.mjs --status to verify heartbeat'} |
    ConvertTo-Json -Compress
  return
}
if ($Stop) {
  [pscustomobject]@{state='SUPERVISOR_STOP_REQUIRED';message='Use existing supervisor STOP; do not clear it here';descendantsVerifiedGone=$false} | ConvertTo-Json -Compress
  return
}
if ($Uninstall) {
  $removed=@()
  for($i=0;$i -lt 3;$i++){
    $task=OwnedTask $i
    if($null -eq $task){continue}
    if([string]$task.State -ne 'Disabled'){throw 'TASK_MAY_BE_RUNNING_STOP_AND_VERIFY_FIRST'}
    Unregister-ScheduledTask -TaskName $names[$i] -Confirm:$false
    $removed+=$names[$i]
  }
  [pscustomobject]@{state='TASKS_UNREGISTERED';tasks=$removed;reviewerPreserved=$true;supervisorPreserved=$true;descendantsVerifiedGone=$false} | ConvertTo-Json -Compress
}
