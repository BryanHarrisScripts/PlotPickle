#Requires -Version 5.1
# #3142 candidate; F00 remains a separately signed restricted Windows service.
[CmdletBinding()]
param(
  [switch]$Plan, [switch]$Status, [switch]$Install,
  [switch]$Start, [switch]$Stop, [switch]$Uninstall,
  [string]$Consent = ''
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
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
function OwnedTask([int]$i) {
  $list = @(Get-ScheduledTask -TaskName $names[$i] -ErrorAction SilentlyContinue)
  if ($list.Count -eq 0) { return $null }
  if ($list.Count -ne 1) { throw 'WORKER_TASK_AMBIGUOUS' }
  $task = $list[0]
  $args = ('"{0}" --serve {1}' -f $script,$roles[$i])
  if ($task.TaskPath -ne '\' -or @($task.Actions).Count -ne 1 -or
      $task.Actions[0].Execute -cne $node -or $task.Actions[0].Arguments -cne $args -or
      $task.Actions[0].WorkingDirectory -cne $repo -or
      $task.Principal.UserId -notin @($who.Name,$who.User.Value)) { throw 'WORKER_TASK_OWNERSHIP_UNVERIFIED' }
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
if (@(Get-ScheduledTask -TaskName 'PlotPickleSoftwareFactory' -ErrorAction SilentlyContinue).Count -ne 0) { throw 'LEGACY_PI_TASK_PRESENT_REVIEW_SEPARATELY' }
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
  $null=ExactHead
  for($i=0;$i -lt 3;$i++){ $null=OwnedTask $i }
  [pscustomobject]@{state='BLOCKED';code='F00_SIGNED_W8W9_AND_OWNER_WINDOWS_PRODUCT_GATE_REQUIRED';tasksStarted=0;codingOnline=$false} | ConvertTo-Json -Compress
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
